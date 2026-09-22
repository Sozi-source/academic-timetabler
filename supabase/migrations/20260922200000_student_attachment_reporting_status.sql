-- Student operational status controls.
-- Attachment is an academic phase while Not Reported is the current-period
-- reporting state. They are deliberately independent of lifecycle status.

begin;

create or replace function public.set_student_status(
  target_student_id uuid,
  target_status text,
  effective_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_rec public.students%rowtype;
  event_value public.student_lifecycle_event_type;
  phase_value public.student_academic_phase;
  event_id uuid;
  old_status public.student_lifecycle_status;
  active_period_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Only an HOD or system administrator can update student status';
  end if;
  if effective_date is null then effective_date := current_date; end if;

  select * into student_rec from public.students where id = target_student_id for update;
  if student_rec.id is null then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;
  if not public.current_user_can_manage_department(student_rec.department_id) then
    raise exception using errcode = '42501', message = 'You cannot manage this student';
  end if;

  -- Operational status: place the student on attachment without changing
  -- their lifecycle status. Selecting In Class removes the attachment phase.
  if target_status in ('attachment', 'in_class') then
    if target_status = 'attachment' and student_rec.lifecycle_status not in ('active','admitted') then
      raise exception using errcode = '22023', message = 'Only active students can be placed on attachment';
    end if;
    update public.students
       set academic_phase = case when target_status = 'attachment'
                                 then 'attachment'::public.student_academic_phase
                                 else 'in_class'::public.student_academic_phase end,
           updated_by = auth.uid(), updated_at = now()
     where id = target_student_id;
    return null;
  end if;

  -- Operational status: Not Reported means the student has not confirmed
  -- reporting for the current active academic period. Attendance already
  -- treats every non-'reported' value as not_reported.
  if target_status in ('not_reported', 'reported') then
    select id into active_period_id
      from public.academic_periods
     where status = 'active'
     order by teaching_starts_on desc nulls last, created_at desc
     limit 1;

    if active_period_id is null then
      raise exception using errcode = 'P0002', message = 'No active academic period found';
    end if;

    insert into public.student_period_reporting (
      department_id, student_id, academic_period_id, reporting_status,
      reported_on, confirmed_at, confirmed_by, updated_at
    ) values (
      student_rec.department_id, target_student_id, active_period_id,
      case when target_status = 'reported' then 'reported' else 'pending' end,
      case when target_status = 'reported' then effective_date else null end,
      case when target_status = 'reported' then now() else null end,
      case when target_status = 'reported' then auth.uid() else null end,
      now()
    )
    on conflict (student_id, academic_period_id) do update
      set reporting_status = excluded.reporting_status,
          reported_on = excluded.reported_on,
          confirmed_at = excluded.confirmed_at,
          confirmed_by = excluded.confirmed_by,
          updated_at = now();
    return null;
  end if;

  -- Lifecycle status.
  if target_status not in ('active','deferred','dropped_out','suspended','completed','graduated') then
    raise exception using errcode = '22023', message = 'Invalid target status';
  end if;

  old_status := student_rec.lifecycle_status;
  if old_status::text = target_status then return null; end if;

  event_value := case target_status
    when 'deferred' then 'deferral'::public.student_lifecycle_event_type
    when 'dropped_out' then 'dropout'::public.student_lifecycle_event_type
    when 'suspended' then 'administrative_correction'::public.student_lifecycle_event_type
    when 'completed' then 'programme_completion'::public.student_lifecycle_event_type
    when 'graduated' then 'graduation'::public.student_lifecycle_event_type
    when 'active' then 'resumption'::public.student_lifecycle_event_type
  end;

  phase_value := case target_status
    when 'deferred' then 'deferred'::public.student_academic_phase
    when 'dropped_out' then 'dropped_out'::public.student_academic_phase
    when 'suspended' then 'in_class'::public.student_academic_phase
    when 'completed' then 'awaiting_graduation'::public.student_academic_phase
    when 'graduated' then 'graduated'::public.student_academic_phase
    else 'in_class'::public.student_academic_phase
  end;

  update public.students
  set lifecycle_status = target_status::public.student_lifecycle_status,
      academic_phase = phase_value,
      completion_date = case when target_status = 'completed' then effective_date when target_status = 'active' then completion_date else completion_date end,
      graduation_date = case when target_status = 'graduated' then effective_date else graduation_date end,
      updated_by = auth.uid(), updated_at = now()
  where id = target_student_id;

  insert into public.student_lifecycle_events(
    student_id, event_type, effective_date, from_cohort_id, to_cohort_id, created_by
  ) values (
    target_student_id, event_value, effective_date, student_rec.current_cohort_id, student_rec.current_cohort_id, auth.uid()
  ) returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.set_student_status(uuid,text,date) from public;
grant execute on function public.set_student_status(uuid,text,date) to authenticated;

comment on function public.set_student_status(uuid,text,date) is
  'Updates lifecycle status or operational placement/reporting status. Attachment and Not Reported do not alter lifecycle status; no reason is required.';

commit;
