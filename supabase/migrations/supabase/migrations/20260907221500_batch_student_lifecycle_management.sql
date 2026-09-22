-- ============================================================
-- Migration: 20260907221500_batch_student_lifecycle_management.sql
-- Transactional batch student lifecycle management & cohort reassignment
-- ============================================================

-- 1. Batch Student Status Update (Active / Deferred / Dropped Out / Withdrawn)
create or replace function public.batch_update_student_status(
  target_student_ids uuid[],
  target_status text,
  effective_date date default current_date,
  reason text default null,
  expected_resume_on date default null,
  target_academic_period_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer := 0;
  student_rec record;
  trans_event public.student_lifecycle_event_type;
  next_phase public.student_academic_phase;
  target_status_enum public.student_lifecycle_status;
  active_period_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Only an HOD or system administrator can perform batch status updates';
  end if;

  if coalesce(cardinality(target_student_ids), 0) = 0 then
    raise exception using errcode = '22023', message = 'At least one student must be selected';
  end if;

  if target_status not in ('active', 'deferred', 'dropped_out', 'withdrawn') then
    raise exception using errcode = '22023', message = 'Invalid target status. Must be active, deferred, dropped_out, or withdrawn';
  end if;

  if target_status in ('deferred', 'dropped_out', 'withdrawn')
     and nullif(trim(coalesce(reason, '')), '') is null then
    raise exception using errcode = '22023', message = 'A reason is required when deferring or dropping out';
  end if;

  if target_status = 'deferred' and (expected_resume_on is null or expected_resume_on <= effective_date) then
    raise exception using errcode = '22023', message = 'A future expected resumption date is required for deferral';
  end if;

  -- Resolve event type and phase
  if target_status = 'active' then
    trans_event := 'resumption'::public.student_lifecycle_event_type;
    next_phase := 'in_class'::public.student_academic_phase;
    target_status_enum := 'active'::public.student_lifecycle_status;
  elsif target_status = 'deferred' then
    trans_event := 'deferral'::public.student_lifecycle_event_type;
    next_phase := 'deferred'::public.student_academic_phase;
    target_status_enum := 'deferred'::public.student_lifecycle_status;
  elsif target_status = 'dropped_out' then
    trans_event := 'withdrawal'::public.student_lifecycle_event_type;
    next_phase := 'dropped_out'::public.student_academic_phase;
    target_status_enum := 'dropped_out'::public.student_lifecycle_status;
  else
    trans_event := 'withdrawal'::public.student_lifecycle_event_type;
    next_phase := 'dropped_out'::public.student_academic_phase;
    target_status_enum := 'withdrawn'::public.student_lifecycle_status;
  end if;

  -- Resolve active period if not supplied
  if target_academic_period_id is not null then
    active_period_id := target_academic_period_id;
  else
    select id into active_period_id
    from public.academic_periods
    where status = 'active'
    limit 1;
  end if;

  -- Iterate through target students, verifying department access
  for student_rec in
    select id, department_id, current_cohort_id, lifecycle_status
    from public.students
    where id = any(target_student_ids)
    for update
  loop
    if not public.current_user_can_manage_department(student_rec.department_id) then
      raise exception using errcode = '42501', message = 'You do not have permission to manage one or more of the selected students';
    end if;

    -- Update student status and phase
    update public.students
    set lifecycle_status = target_status_enum,
        academic_phase = next_phase,
        updated_at = now()
    where id = student_rec.id;

    -- Log lifecycle event
    insert into public.student_lifecycle_events (
      student_id,
      event_type,
      effective_date,
      expected_resume_date,
      reason,
      notes,
      from_cohort_id,
      to_cohort_id
    ) values (
      student_rec.id,
      trans_event,
      coalesce(effective_date, current_date),
      case when target_status = 'deferred' then expected_resume_on else null end,
      coalesce(reason, 'Batch status update by HOD'),
      'Updated via Student Registry Batch Action',
      student_rec.current_cohort_id,
      student_rec.current_cohort_id
    );

    -- Synchronize reporting if active period is present
    if active_period_id is not null then
      if target_status = 'active' then
        insert into public.student_period_reporting (
          department_id,
          student_id,
          academic_period_id,
          reporting_status,
          reported_on,
          confirmed_at,
          confirmed_by,
          notes
        ) values (
          student_rec.department_id,
          student_rec.id,
          active_period_id,
          'reported',
          coalesce(effective_date, current_date),
          now(),
          auth.uid(),
          coalesce(reason, 'Reporting confirmed via batch action')
        )
        on conflict (student_id, academic_period_id) do update
          set reporting_status = 'reported',
              reported_on = excluded.reported_on,
              confirmed_at = excluded.confirmed_at,
              confirmed_by = excluded.confirmed_by,
              updated_at = now();
      elsif target_status in ('deferred', 'dropped_out', 'withdrawn') then
        update public.student_period_reporting
        set reporting_status = case when target_status = 'deferred' then 'deferred' else 'dropped_out' end,
            updated_at = now()
        where student_id = student_rec.id
          and academic_period_id = active_period_id;
      end if;
    end if;

    updated_count := updated_count + 1;
  end loop;

  return jsonb_build_object(
    'updated_count', updated_count,
    'target_status', target_status
  );
end;
$$;

-- 2. Batch Student Cohort Reassignment (For Repeaters / Intake Transfers)
create or replace function public.batch_reassign_student_cohort(
  target_student_ids uuid[],
  new_cohort_id uuid,
  effective_date date default current_date,
  reason text default 'Cohort reassignment (repeat/progression)',
  notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reassigned_count integer := 0;
  student_rec record;
  target_cohort_rec public.cohorts%rowtype;
  current_assignment public.student_cohort_assignments%rowtype;
  eff_date date := coalesce(effective_date, current_date);
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Only an HOD or system administrator can reassign student cohorts';
  end if;

  if coalesce(cardinality(target_student_ids), 0) = 0 then
    raise exception using errcode = '22023', message = 'At least one student must be selected';
  end if;

  if new_cohort_id is null then
    raise exception using errcode = '22023', message = 'Target cohort must be specified';
  end if;

  -- Verify target cohort exists and is planned or active
  select * into target_cohort_rec
  from public.cohorts
  where id = new_cohort_id;

  if target_cohort_rec.id is null then
    raise exception using errcode = 'P0002', message = 'Target cohort not found';
  end if;

  if target_cohort_rec.status not in ('planned', 'active') then
    raise exception using errcode = 'P0001', message = 'Target cohort must be planned or active';
  end if;

  -- Iterate through target students
  for student_rec in
    select id, department_id, programme_id, current_cohort_id, admission_cohort_id
    from public.students
    where id = any(target_student_ids)
    for update
  loop
    if not public.current_user_can_manage_department(student_rec.department_id) then
      raise exception using errcode = '42501', message = 'You do not have permission to manage one or more of the selected students';
    end if;

    -- Enforce programme compatibility
    if target_cohort_rec.programme_id <> student_rec.programme_id then
      raise exception using errcode = 'P0001', message = 'Target cohort does not belong to the student programme';
    end if;

    -- Skip if already assigned to this cohort
    if student_rec.current_cohort_id = new_cohort_id then
      continue;
    end if;

    -- Close current open cohort assignment if exists
    select * into current_assignment
    from public.student_cohort_assignments
    where student_id = student_rec.id and effective_to is null
    order by effective_from desc
    limit 1
    for update;

    if current_assignment.id is not null then
      update public.student_cohort_assignments
      set effective_to = eff_date - 1
      where id = current_assignment.id;
    end if;

    -- Insert new active cohort assignment (admission cohort remains immutable!)
    insert into public.student_cohort_assignments (
      student_id,
      cohort_id,
      effective_from,
      is_admission_cohort,
      assignment_reason,
      notes
    ) values (
      student_rec.id,
      new_cohort_id,
      eff_date,
      false,
      coalesce(reason, 'Cohort reassignment (repeat/progression)'),
      nullif(trim(coalesce(notes, '')), '')
    );

    -- Update student record with new current_cohort_id
    update public.students
    set current_cohort_id = new_cohort_id,
        projected_completion_date = coalesce(target_cohort_rec.expected_completion_date, projected_completion_date),
        updated_at = now()
    where id = student_rec.id;

    -- Log audit lifecycle event
    insert into public.student_lifecycle_events (
      student_id,
      event_type,
      effective_date,
      reason,
      notes,
      from_cohort_id,
      to_cohort_id
    ) values (
      student_rec.id,
      'cohort_change'::public.student_lifecycle_event_type,
      eff_date,
      coalesce(reason, 'Cohort reassignment'),
      nullif(trim(coalesce(notes, '')), ''),
      student_rec.current_cohort_id,
      new_cohort_id
    );

    reassigned_count := reassigned_count + 1;
  end loop;

  return jsonb_build_object(
    'reassigned_count', reassigned_count,
    'new_cohort_id', new_cohort_id
  );
end;
$$;

grant execute on function public.batch_update_student_status to authenticated;
grant execute on function public.batch_reassign_student_cohort to authenticated;

comment on function public.batch_update_student_status is
  'Transaction-safe batch updater for student lifecycle status (active, deferred, dropped_out, withdrawn) with automatic audit logging and reporting sync.';

comment on function public.batch_reassign_student_cohort is
  'Transaction-safe batch updater for reassigning repeaters/transfer students to current study cohort while leaving admission cohort immutable.';
