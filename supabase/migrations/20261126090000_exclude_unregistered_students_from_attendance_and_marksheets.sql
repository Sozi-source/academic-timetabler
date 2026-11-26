-- ============================================================================
-- Migration: Exclude Unregistered Students from Attendance Sheets & Marksheets
--
-- Problems:
--   1. Unregistering a student via department_register_student_units (unchecking
--      units) or undo_student_unit_registration deleted from
--      student_unit_registrations without cleaning up assessment_roster,
--      assessment_population, assessment_online_mark_drafts, or
--      class_attendance_entries.
--   2. batchDropStudentUnitRegistrations only cleaned assessment_roster and
--      assessment_population for direct exam events, leaving drafts, sibling
--      unit markbooks, and class_attendance_entries behind.
--   3. ensure_unit_markbook_ready, save_assessment_online_component_marks,
--      submit_assessment_online_marks, save_assessment_component_with_trainer_invite,
--      get_department_class_attendance_workspace, and
--      get_hod_class_attendance_workspace did not re-verify that candidates still
--      hold an active registration ('registered') in student_unit_registrations.
--
-- Fixes:
--   1. Add helper functions:
--      - public.related_unit_ids_for_period(uuid, uuid)
--      - public.student_is_registered_for_unit_or_sibling(uuid, uuid, uuid)
--   2. Add AFTER DELETE / UPDATE trigger on public.student_unit_registrations
--      to immediately purge the student from class_attendance_entries (and
--      recalculate class_sessions.roster_count) and from unfinalized/unsubmitted
--      assessment_roster, assessment_population, and assessment_online_mark_drafts.
--   3. Reconcile existing stale records in class_attendance_entries,
--      assessment_roster, assessment_population, and assessment_online_mark_drafts.
--   4. Upgrade ensure_unit_markbook_ready, save_assessment_online_component_marks,
--      submit_assessment_online_marks, save_assessment_component_with_trainer_invite,
--      get_department_class_attendance_workspace, and
--      get_hod_class_attendance_workspace to enforce active unit registration.
-- ============================================================================

begin;

-- 1. Helper: Discover a unit and its shared/equivalent siblings for a period
create or replace function public.related_unit_ids_for_period(
  p_academic_period_id uuid,
  p_unit_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    array_agg(distinct unit_id) filter (where unit_id is not null),
    array[p_unit_id]
  )
  from (
    select p_unit_id as unit_id
    union
    -- Shared offerings (confirmed_shared_offering_id)
    select uo_sib.unit_id
    from public.unit_offerings uo_base
    join public.unit_offerings uo_sib
      on uo_sib.confirmed_shared_offering_id = uo_base.confirmed_shared_offering_id
     and uo_sib.academic_period_id = p_academic_period_id
    where uo_base.unit_id = p_unit_id
      and uo_base.academic_period_id = p_academic_period_id
      and uo_base.confirmed_shared_offering_id is not null
    union
    -- Shared teaching offerings (teaching_offering_id)
    select ta_sib.unit_id
    from public.teaching_allocations ta_base
    join public.teaching_allocations ta_sib
      on ta_sib.teaching_offering_id = ta_base.teaching_offering_id
     and ta_sib.academic_period_id = p_academic_period_id
    where ta_base.unit_id = p_unit_id
      and ta_base.academic_period_id = p_academic_period_id
      and ta_base.teaching_offering_id is not null
    union
    -- Approved unit equivalence groups
    select eq_sib.unit_id
    from public.unit_equivalence_members eq_base
    join public.unit_equivalence_members eq_sib
      on eq_sib.equivalence_group_id = eq_base.equivalence_group_id
     and eq_sib.status = 'approved'
    where eq_base.unit_id = p_unit_id
      and eq_base.status = 'approved'
  ) related;
$$;

revoke all on function public.related_unit_ids_for_period(uuid, uuid) from public;
grant execute on function public.related_unit_ids_for_period(uuid, uuid) to authenticated, service_role;

-- 2. Helper: Check whether a student holds an active 'registered' registration
--    for the unit (or any shared/equivalent sibling, including active class assignments)
create or replace function public.student_is_registered_for_unit_or_sibling(
  p_student_id uuid,
  p_academic_period_id uuid,
  p_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.student_unit_registrations sur
      where sur.student_id = p_student_id
        and sur.academic_period_id = p_academic_period_id
        and sur.registration_status = 'registered'
        and sur.unit_id = any(public.related_unit_ids_for_period(p_academic_period_id, p_unit_id))
    )
    or exists (
      select 1
      from public.student_class_assignments sca
      join public.teaching_allocations ta
        on ta.id = sca.teaching_allocation_id
       and ta.academic_period_id = p_academic_period_id
      join public.student_unit_registrations sur
        on sur.id = sca.source_registration_id
       and sur.registration_status = 'registered'
      where sca.student_id = p_student_id
        and sca.academic_period_id = p_academic_period_id
        and sca.is_active = true
        and ta.unit_id = any(public.related_unit_ids_for_period(p_academic_period_id, p_unit_id))
    );
$$;

revoke all on function public.student_is_registered_for_unit_or_sibling(uuid, uuid, uuid) from public;
grant execute on function public.student_is_registered_for_unit_or_sibling(uuid, uuid, uuid) to authenticated, service_role;

-- 3. Trigger function: Purge unregistered students from attendance & open markbooks
create or replace function public.handle_student_unit_registration_removal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_related_unit_ids uuid[];
  v_affected_session_ids uuid[];
begin
  if tg_op = 'DELETE' then
    if old.registration_status::text <> 'registered' then
      return old;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.registration_status::text <> 'registered' or new.registration_status::text = 'registered' then
      return new;
    end if;
  end if;

  -- If the student still holds an active registration in an equivalent/shared unit for this period,
  -- keep them on the shared attendance & marksheet records.
  if public.student_is_registered_for_unit_or_sibling(old.student_id, old.academic_period_id, old.unit_id) then
    return coalesce(new, old);
  end if;

  v_related_unit_ids := public.related_unit_ids_for_period(old.academic_period_id, old.unit_id);

  -- A. Remove attendance entries for this unit (and shared sessions) in this period
  with deleted_entries as (
    delete from public.class_attendance_entries cae
    using public.class_sessions cs
    where cae.class_session_id = cs.id
      and cae.student_id = old.student_id
      and cs.academic_period_id = old.academic_period_id
      and (
        cs.unit_id = any(v_related_unit_ids)
        or cs.teaching_allocation_id in (
          select ta.id
          from public.teaching_allocations ta
          where ta.academic_period_id = old.academic_period_id
            and ta.unit_id = any(v_related_unit_ids)
        )
      )
      and not public.student_is_registered_for_unit_or_sibling(old.student_id, cs.academic_period_id, cs.unit_id)
    returning cae.class_session_id
  )
  select coalesce(array_agg(distinct class_session_id), array[]::uuid[])
  into v_affected_session_ids
  from deleted_entries;

  if coalesce(array_length(v_affected_session_ids, 1), 0) > 0 then
    update public.class_sessions cs
    set roster_count = (
          select count(*)::integer
          from public.class_attendance_entries cae
          where cae.class_session_id = cs.id
        ),
        updated_at = now()
    where cs.id = any(v_affected_session_ids);
  end if;

  -- B. Remove from unsubmitted/unfinalized markbooks without committed results
  delete from public.assessment_roster ar
  using public.assessment_events ae
  where ar.assessment_id = ae.id
    and ar.student_id = old.student_id
    and ae.academic_period_id = old.academic_period_id
    and ae.unit_id = any(v_related_unit_ids)
    and ae.status <> 'closed'
    and ae.exam_marks_finalized_at is null
    and ae.marks_submitted_at is null
    and not public.student_is_registered_for_unit_or_sibling(old.student_id, ae.academic_period_id, ae.unit_id)
    and not exists (
      select 1
      from public.assessment_results res
      where res.assessment_event_id = ae.id
        and res.student_id = old.student_id
    );

  delete from public.assessment_population ap
  using public.assessment_events ae
  where ap.assessment_event_id = ae.id
    and ap.student_id = old.student_id
    and ae.academic_period_id = old.academic_period_id
    and ae.unit_id = any(v_related_unit_ids)
    and ae.status <> 'closed'
    and ae.exam_marks_finalized_at is null
    and ae.marks_submitted_at is null
    and not public.student_is_registered_for_unit_or_sibling(old.student_id, ae.academic_period_id, ae.unit_id)
    and not exists (
      select 1
      from public.assessment_results res
      where res.assessment_event_id = ae.id
        and res.student_id = old.student_id
    );

  delete from public.assessment_online_mark_drafts d
  using public.assessment_events ae
  where d.assessment_id = ae.id
    and d.student_id = old.student_id
    and ae.academic_period_id = old.academic_period_id
    and ae.unit_id = any(v_related_unit_ids)
    and ae.status <> 'closed'
    and ae.exam_marks_finalized_at is null
    and ae.marks_submitted_at is null
    and not public.student_is_registered_for_unit_or_sibling(old.student_id, ae.academic_period_id, ae.unit_id)
    and not exists (
      select 1
      from public.assessment_results res
      where res.assessment_event_id = ae.id
        and res.student_id = old.student_id
    );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trigger_sync_student_unit_registration_removal on public.student_unit_registrations;
create trigger trigger_sync_student_unit_registration_removal
  after delete or update of registration_status on public.student_unit_registrations
  for each row
  execute function public.handle_student_unit_registration_removal();

-- 4. One-off cleanup of already-unregistered students from attendance & open markbooks
with deleted_stale_attendance as (
  delete from public.class_attendance_entries cae
  using public.class_sessions cs
  where cae.class_session_id = cs.id
    and cs.unit_id is not null
    and cs.academic_period_id is not null
    and not public.student_is_registered_for_unit_or_sibling(
      cae.student_id,
      cs.academic_period_id,
      cs.unit_id
    )
  returning cae.class_session_id
),
affected_sessions as (
  select distinct class_session_id
  from deleted_stale_attendance
)
update public.class_sessions cs
set roster_count = (
      select count(*)::integer
      from public.class_attendance_entries cae
      where cae.class_session_id = cs.id
    ),
    updated_at = now()
where cs.id in (select class_session_id from affected_sessions);

delete from public.assessment_roster ar
using public.assessment_events ae
where ar.assessment_id = ae.id
  and ae.status <> 'closed'
  and ae.exam_marks_finalized_at is null
  and ae.marks_submitted_at is null
  and not public.student_is_registered_for_unit_or_sibling(
    ar.student_id,
    ae.academic_period_id,
    ae.unit_id
  )
  and not exists (
    select 1
    from public.assessment_results res
    where res.assessment_event_id = ae.id
      and res.student_id = ar.student_id
  );

delete from public.assessment_population ap
using public.assessment_events ae
where ap.assessment_event_id = ae.id
  and ae.status <> 'closed'
  and ae.exam_marks_finalized_at is null
  and ae.marks_submitted_at is null
  and not public.student_is_registered_for_unit_or_sibling(
    ap.student_id,
    ae.academic_period_id,
    ae.unit_id
  )
  and not exists (
    select 1
    from public.assessment_results res
    where res.assessment_event_id = ae.id
      and res.student_id = ap.student_id
  );

delete from public.assessment_online_mark_drafts d
using public.assessment_events ae
where d.assessment_id = ae.id
  and ae.status <> 'closed'
  and ae.exam_marks_finalized_at is null
  and ae.marks_submitted_at is null
  and not public.student_is_registered_for_unit_or_sibling(
    d.student_id,
    ae.academic_period_id,
    ae.unit_id
  )
  and not exists (
    select 1
    from public.assessment_results res
    where res.assessment_event_id = ae.id
      and res.student_id = d.student_id
  );

-- 5. Upgrade ensure_unit_markbook_ready to also prune unregistered students
create or replace function public.ensure_unit_markbook_ready(
  p_academic_period_id uuid,
  p_unit_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_department_id uuid;
  v_related_unit_ids uuid[];
  v_is_locked_or_finalized boolean := false;
begin
  select coalesce(unit.department_id, programme.department_id)
  into v_department_id
  from public.units unit
  left join public.programmes programme on programme.id = unit.programme_id
  where unit.id = p_unit_id;

  if v_department_id is null then
    raise exception 'Cannot prepare a markbook for a unit without a department.'
      using errcode = '23514';
  end if;

  -- 1. Shared offerings (same department)
  select array_agg(distinct related_offering.unit_id)
  into v_related_unit_ids
  from public.unit_offerings base_offering
  join public.unit_offerings related_offering
    on related_offering.confirmed_shared_offering_id = base_offering.confirmed_shared_offering_id
   and related_offering.academic_period_id = p_academic_period_id
  join public.units related_unit
    on related_unit.id = related_offering.unit_id
  left join public.programmes related_programme
    on related_programme.id = related_unit.programme_id
  where base_offering.unit_id = p_unit_id
    and base_offering.academic_period_id = p_academic_period_id
    and base_offering.confirmed_shared_offering_id is not null
    and coalesce(related_unit.department_id, related_programme.department_id) = v_department_id;

  -- 2. Equivalence groups
  select coalesce(v_related_unit_ids, array[]::uuid[]) || coalesce(array_agg(distinct eq_sib.unit_id), array[]::uuid[])
  into v_related_unit_ids
  from public.unit_equivalence_members eq_base
  join public.unit_equivalence_members eq_sib
    on eq_sib.equivalence_group_id = eq_base.equivalence_group_id
   and eq_sib.status = 'approved'
  where eq_base.unit_id = p_unit_id
    and eq_base.status = 'approved';

  v_related_unit_ids := array_append(coalesce(v_related_unit_ids, array[]::uuid[]), p_unit_id);

  select id into v_event_id
  from public.assessment_events
  where academic_period_id = p_academic_period_id
    and unit_id = p_unit_id
    and assessment_type = 'exam'
  order by created_at desc
  limit 1;

  if v_event_id is not null then
    select (
      status = 'closed'
      or exam_marks_finalized_at is not null
      or marks_submitted_at is not null
    )
    into v_is_locked_or_finalized
    from public.assessment_events
    where id = v_event_id;

    update public.assessment_events
    set operational_assessment_type = 'exam',
        operational_workflow_status = coalesce(operational_workflow_status, 'open'),
        population_locked_at = coalesce(population_locked_at, now()),
        max_mark = 100,
        pass_mark = 40
    where id = v_event_id;

    if not coalesce(v_is_locked_or_finalized, false) then
      delete from public.assessment_roster ar
      where ar.assessment_id = v_event_id
        and not public.student_is_registered_for_unit_or_sibling(ar.student_id, p_academic_period_id, p_unit_id)
        and not exists (
          select 1 from public.assessment_results res
          where res.assessment_event_id = v_event_id
            and res.student_id = ar.student_id
        );

      delete from public.assessment_population ap
      where ap.assessment_event_id = v_event_id
        and not public.student_is_registered_for_unit_or_sibling(ap.student_id, p_academic_period_id, p_unit_id)
        and not exists (
          select 1 from public.assessment_results res
          where res.assessment_event_id = v_event_id
            and res.student_id = ap.student_id
        );

      delete from public.assessment_online_mark_drafts d
      where d.assessment_id = v_event_id
        and not public.student_is_registered_for_unit_or_sibling(d.student_id, p_academic_period_id, p_unit_id)
        and not exists (
          select 1 from public.assessment_results res
          where res.assessment_event_id = v_event_id
            and res.student_id = d.student_id
        );
    end if;
  else
    insert into public.assessment_events (
      department_id,
      academic_period_id,
      unit_id,
      cohort_id,
      assessment_type,
      operational_assessment_type,
      operational_workflow_status,
      title,
      max_mark,
      pass_mark,
      status,
      population_locked_at
    ) values (
      v_department_id,
      p_academic_period_id,
      p_unit_id,
      null,
      'exam',
      'exam',
      'open',
      'Unit Markbook',
      100,
      40,
      'open',
      now()
    ) returning id into v_event_id;
  end if;

  insert into public.assessment_rules (
    academic_period_id, unit_id, assessment_type, maximum_mark, pass_mark
  ) values (
    p_academic_period_id, p_unit_id, 'exam', 100, 40
  )
  on conflict (academic_period_id, unit_id, assessment_type)
  do update set maximum_mark = 100, pass_mark = 40;

  -- Populate / update roster strictly for active registered students expected to sit
  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    snapshot_registration_status,
    pre_assessment_status
  )
  select distinct on (registration.student_id)
    v_event_id,
    registration.student_id,
    coalesce(registration.cohort_id, student.current_cohort_id),
    p_academic_period_id,
    registration.unit_id,
    registration.registration_status,
    'expected'
  from public.student_unit_registrations registration
  join public.students student on student.id = registration.student_id
  join public.units registered_unit on registered_unit.id = registration.unit_id
  left join public.programmes registered_programme on registered_programme.id = registered_unit.programme_id
  where registration.unit_id = any(v_related_unit_ids)
    and registration.academic_period_id = p_academic_period_id
    and registration.registration_status = 'registered'
    and coalesce(registered_unit.department_id, registered_programme.department_id) = v_department_id
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(student.academic_phase, 'in_class') = 'in_class'
  order by registration.student_id, registration.registered_at desc
  on conflict do nothing;

  return v_event_id;
end;
$$;

revoke all on function public.ensure_unit_markbook_ready(uuid, uuid) from public, anon;
grant execute on function public.ensure_unit_markbook_ready(uuid, uuid) to authenticated, service_role;

-- 6. Upgrade save_assessment_online_component_marks to require active registration
create or replace function public.save_assessment_online_component_marks(
  target_assessment_id uuid,
  target_component text,
  target_entries jsonb,
  submit_component boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  merged_entries jsonb;
  submission_cohorts uuid[];
  sibling_event_ids uuid[];
  sib_id uuid;
  result jsonb;
  final_ready boolean;
begin
  if auth.uid() is null or not public.assessment_actor_can_manage_assessment(target_assessment_id) then
    raise exception 'This assessment is outside your Teaching Allocations.' using errcode = '42501';
  end if;
  if target_component = 'all' and submit_component then
    raise exception 'Choose one component to submit.' using errcode = '22023';
  end if;

  -- Ensure any active, registered students in target_entries exist in assessment_roster before validation
  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    pre_assessment_status
  )
  select distinct
    target_assessment_id,
    item.student_id,
    coalesce(s.current_cohort_id, s.admission_cohort_id),
    ae.academic_period_id,
    ae.unit_id,
    'expected'
  from jsonb_to_recordset(target_entries) as item(student_id uuid)
  join public.students s on s.id = item.student_id
  join public.assessment_events ae on ae.id = target_assessment_id
  where s.lifecycle_status in ('admitted', 'active')
    and coalesce(s.academic_phase, 'in_class') = 'in_class'
    and public.student_is_registered_for_unit_or_sibling(s.id, ae.academic_period_id, ae.unit_id)
    and not exists (
      select 1 from public.assessment_roster r
      where r.assessment_id = target_assessment_id
        and r.student_id = item.student_id
    )
  on conflict (assessment_id, student_id) do nothing;

  -- Cohort completeness validation: only require active, registered classroom students
  if submit_component and exists (
    select 1
    from (select distinct roster.cohort_id from public.assessment_roster roster
          join jsonb_to_recordset(target_entries) as item(student_id uuid)
            on item.student_id = roster.student_id
          where roster.assessment_id = target_assessment_id) selected_cohorts
    join public.assessment_roster roster
      on roster.assessment_id = target_assessment_id
     and roster.cohort_id is not distinct from selected_cohorts.cohort_id
    join public.assessment_events ae
      on ae.id = roster.assessment_id
    join public.students student
      on student.id = roster.student_id
    where student.lifecycle_status in ('admitted', 'active')
      and coalesce(student.academic_phase, 'in_class') = 'in_class'
      and public.student_is_registered_for_unit_or_sibling(student.id, ae.academic_period_id, ae.unit_id)
      and not exists (
        select 1 from jsonb_to_recordset(target_entries) as item(student_id uuid)
        where item.student_id = roster.student_id
      )
  ) then
    raise exception 'Include every student in a cohort before submitting its component.' using errcode = '23514';
  end if;

  merged_entries := public.build_assessment_mark_component_entries(
    target_assessment_id, null, target_component, target_entries
  );

  -- Keep CAT absence as an explicit roster status.
  if target_component in ('all', 'cat') then
    update public.assessment_roster roster
    set cat_absent = coalesce(item.cat_absent, false)
    from jsonb_to_recordset(target_entries) as item(student_id uuid, cat_absent boolean)
    where roster.assessment_id = target_assessment_id
      and roster.student_id = item.student_id;
  end if;

  if submit_component and exists (
    select 1
    from jsonb_to_recordset(merged_entries) as item(
      student_id uuid, assignment numeric, presentation numeric, rat numeric, cat numeric, exam numeric
    )
    join public.assessment_roster roster
      on roster.assessment_id = target_assessment_id and roster.student_id = item.student_id
    join public.assessment_events ae
      on ae.id = roster.assessment_id
    join public.students student
      on student.id = roster.student_id
    where student.lifecycle_status in ('admitted', 'active')
      and coalesce(student.academic_phase, 'in_class') = 'in_class'
      and public.student_is_registered_for_unit_or_sibling(student.id, ae.academic_period_id, ae.unit_id)
      and (
        (target_component = 'assignment' and item.assignment is null)
        or (target_component = 'presentation' and item.presentation is null)
        or (target_component = 'rat' and item.rat is null)
        or (target_component = 'cat' and item.cat is null and not roster.cat_absent)
        or (target_component = 'exam' and roster.pre_assessment_status = 'expected' and item.exam is null)
      )
  ) then
    raise exception 'Complete this component for the selected students before submitting.' using errcode = '23514';
  end if;

  result := public.save_assessment_online_marks(target_assessment_id, merged_entries);

  if submit_component then
    select coalesce(array_agg(distinct sibling_id), array[target_assessment_id])
    into sibling_event_ids
    from (
      select target_assessment_id as sibling_id
      union
      select ae_sib.id as sibling_id
      from public.assessment_events ae_target
      join public.unit_offerings uo_target
        on uo_target.unit_id = ae_target.unit_id
       and uo_target.academic_period_id = ae_target.academic_period_id
       and uo_target.confirmed_shared_offering_id is not null
      join public.unit_offerings uo_sib
        on uo_sib.confirmed_shared_offering_id = uo_target.confirmed_shared_offering_id
       and uo_sib.academic_period_id = uo_target.academic_period_id
      join public.assessment_events ae_sib
        on ae_sib.unit_id = uo_sib.unit_id
       and ae_sib.academic_period_id = uo_sib.academic_period_id
       and ae_sib.assessment_type = 'exam'
      where ae_target.id = target_assessment_id
      union
      select ae_sib.id as sibling_id
      from public.assessment_events ae_target
      join public.unit_equivalence_members eq_target
        on eq_target.unit_id = ae_target.unit_id
       and eq_target.status = 'approved'
      join public.unit_equivalence_members eq_sib
        on eq_sib.equivalence_group_id = eq_target.equivalence_group_id
       and eq_sib.status = 'approved'
      join public.assessment_events ae_sib
        on ae_sib.unit_id = eq_sib.unit_id
       and ae_sib.academic_period_id = ae_target.academic_period_id
       and ae_sib.assessment_type = 'exam'
      where ae_target.id = target_assessment_id
    ) s;

    select array_agg(distinct roster.cohort_id) into submission_cohorts
    from jsonb_to_recordset(merged_entries) as item(student_id uuid)
    join public.assessment_roster roster
      on roster.assessment_id = target_assessment_id and roster.student_id = item.student_id;

    foreach sib_id in array sibling_event_ids loop
      insert into public.assessment_mark_component_submissions (
        assessment_id, cohort_id, component_key, submitted_by
      )
      select sib_id, cohort_id, target_component, auth.uid()
      from unnest(submission_cohorts) as cohort_id
      on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key) do nothing;

      insert into public.assessment_mark_component_submissions (
        assessment_id, cohort_id, component_key, submitted_by
      )
      values (sib_id, null, target_component, auth.uid())
      on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key) do nothing;

      if target_component = 'cat' then
        update public.assessment_events
        set cat_marks_finalized_at = coalesce(cat_marks_finalized_at, now())
        where id = sib_id;
      end if;
    end loop;

    select not exists (
      select 1
      from (
        select distinct roster.cohort_id
        from public.assessment_roster roster
        join public.assessment_events ae on ae.id = roster.assessment_id
        join public.students s on s.id = roster.student_id
        where roster.assessment_id = target_assessment_id
          and s.lifecycle_status in ('admitted', 'active')
          and coalesce(s.academic_phase, 'in_class') = 'in_class'
          and public.student_is_registered_for_unit_or_sibling(s.id, ae.academic_period_id, ae.unit_id)
      ) cohorts
      cross join unnest(array['assignment', 'presentation', 'rat', 'cat', 'exam']::text[]) components(component_key)
      where not exists (
        select 1 from public.assessment_mark_component_submissions submission
        where submission.assessment_id = target_assessment_id
          and submission.cohort_id is not distinct from cohorts.cohort_id
          and submission.component_key = components.component_key
      )
    ) into final_ready;

    if final_ready then
      update public.assessment_events
      set operational_workflow_status = 'submitted',
          marks_submitted_at = coalesce(marks_submitted_at, now())
      where id = any(sibling_event_ids);
    end if;
  end if;

  return result;
end;
$$;

revoke all on function public.save_assessment_online_component_marks(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.save_assessment_online_component_marks(uuid, text, jsonb, boolean) to authenticated;

-- 7. Upgrade submit_assessment_online_marks to require active registration
create or replace function public.submit_assessment_online_marks(
  target_assessment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_status text;
  target_type text;
  target_locked_at timestamptz;
  target_period_id uuid;
  target_unit_id uuid;
  expected_count integer := 0;
  absent_count integer := 0;
  result_count integer := 0;
  submission_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not public.assessment_actor_can_manage_assessment(target_assessment_id) then
    raise exception 'This assessment is outside your Teaching Allocations.' using errcode = '42501';
  end if;

  select
    coalesce(workspace.workflow_status, 'open'),
    coalesce(workspace.assessment_type, 'exam'),
    workspace.population_locked_at,
    workspace.academic_period_id,
    workspace.unit_id
  into
    target_status,
    target_type,
    target_locked_at,
    target_period_id,
    target_unit_id
  from public.assessment_event_workspace as workspace
  where workspace.id = target_assessment_id
  for update;

  if not found then
    raise exception 'Assessment was not found.' using errcode = 'P0002';
  end if;

  if target_status in ('submitted', 'finalised', 'archived') then
    raise exception 'This assessment has already left editable marks entry.' using errcode = '23514';
  end if;

  if target_locked_at is null then
    update public.assessment_events
    set population_locked_at = now()
    where id = target_assessment_id;
  end if;

  insert into public.assessment_rules (
    academic_period_id, unit_id, assessment_type, maximum_mark, pass_mark
  ) values (
    target_period_id, target_unit_id, 'exam', 100, 40
  )
  on conflict (academic_period_id, unit_id, assessment_type)
  do update set maximum_mark = 100, pass_mark = 40;

  select
    count(*) filter (where roster.pre_assessment_status = 'expected')::integer,
    count(*) filter (where roster.pre_assessment_status = 'absent')::integer
  into
    expected_count,
    absent_count
  from public.assessment_roster as roster
  join public.students as student on student.id = roster.student_id
  where roster.assessment_id = target_assessment_id
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(student.academic_phase, 'in_class') = 'in_class'
    and public.student_is_registered_for_unit_or_sibling(student.id, target_period_id, target_unit_id);

  if (expected_count + absent_count) = 0 then
    raise exception 'The assessment roster is empty. No active students found for this unit.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.assessment_roster as roster
    join public.students as student on student.id = roster.student_id
    left join public.assessment_online_mark_drafts as draft
      on draft.assessment_id = roster.assessment_id
     and draft.student_id = roster.student_id
    where roster.assessment_id = target_assessment_id
      and student.lifecycle_status in ('admitted', 'active')
      and coalesce(student.academic_phase, 'in_class') = 'in_class'
      and public.student_is_registered_for_unit_or_sibling(student.id, target_period_id, target_unit_id)
      and (
        draft.student_id is null
        or draft.assignment_mark is null
        or draft.presentation_mark is null
        or draft.rat_mark is null
        or draft.cat_mark is null
        or (roster.pre_assessment_status = 'expected' and draft.exam_mark is null)
        or (roster.pre_assessment_status = 'absent'   and draft.exam_mark is not null)
      )
  ) then
    raise exception
      'Missing marks remain. Assignment, Presentation, RAT and CAT are required for every student; Exam is required for students expected to sit.'
      using errcode = '23514';
  end if;

  delete from public.assessment_results
  where assessment_event_id = target_assessment_id;

  insert into public.assessment_results (
    assessment_event_id,
    student_id,
    cohort_id,
    component_marks,
    total_mark,
    grade,
    comment,
    operational_mark,
    operational_result_status,
    import_source,
    imported_at
  )
  select
    roster.assessment_id,
    roster.student_id,
    roster.cohort_id,
    jsonb_build_object(
      'assignment', draft.assignment_mark,
      'presentation', draft.presentation_mark,
      'rat', draft.rat_mark,
      'cat1', draft.cat_mark,
      'ratCatAverage', (draft.rat_mark + draft.cat_mark) / 2.0,
      'coursework', draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0),
      'exam', case when roster.pre_assessment_status = 'absent' then null else draft.exam_mark end,
      'total', case
        when roster.pre_assessment_status = 'absent' then null
        else draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark
      end
    ),
    case
      when roster.pre_assessment_status = 'absent' then null
      else round((draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark)::numeric, 2)
    end,
    case
      when roster.pre_assessment_status = 'absent' then 'ABSENT'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 75 then 'DISTINCTION'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 65 then 'CREDIT'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 40 then 'PASS'
      else 'REFER'
    end,
    case
      when roster.pre_assessment_status = 'absent' then 'Exam Absent'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 40 then 'Pass'
      else 'Refer'
    end,
    case
      when roster.pre_assessment_status = 'absent' then null
      else round((draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark)::numeric, 2)
    end,
    case
      when roster.pre_assessment_status = 'absent' then 'absent'
      else 'sat'
    end,
    'online',
    now()
  from public.assessment_roster as roster
  join public.students as student on student.id = roster.student_id
  join public.assessment_online_mark_drafts as draft
    on draft.assessment_id = roster.assessment_id
   and draft.student_id = roster.student_id
  where roster.assessment_id = target_assessment_id
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(student.academic_phase, 'in_class') = 'in_class'
    and public.student_is_registered_for_unit_or_sibling(student.id, target_period_id, target_unit_id);

  get diagnostics result_count = row_count;

  insert into public.assessment_results (
    assessment_event_id,
    student_id,
    cohort_id,
    component_marks,
    total_mark,
    grade,
    comment,
    operational_mark,
    operational_result_status,
    import_source,
    imported_at
  )
  select
    sibling_ae.id,
    res.student_id,
    res.cohort_id,
    res.component_marks,
    res.total_mark,
    res.grade,
    res.comment,
    res.operational_mark,
    res.operational_result_status,
    'online',
    now()
  from public.assessment_results res
  join public.student_unit_registrations sur
    on sur.student_id = res.student_id
   and sur.academic_period_id = target_period_id
   and sur.registration_status = 'registered'
  join public.assessment_events sibling_ae
    on sibling_ae.academic_period_id = target_period_id
   and sibling_ae.unit_id = sur.unit_id
   and (sibling_ae.operational_assessment_type in ('exam', 'unit_markbook') or sibling_ae.assessment_type in ('exam', 'unit_markbook'))
  where res.assessment_event_id = target_assessment_id
    and sibling_ae.id <> target_assessment_id
  on conflict (assessment_event_id, student_id)
  do update set
    component_marks = excluded.component_marks,
    total_mark = excluded.total_mark,
    grade = excluded.grade,
    comment = excluded.comment,
    operational_mark = excluded.operational_mark,
    operational_result_status = excluded.operational_result_status,
    updated_at = now();

  insert into public.assessment_online_mark_submissions (
    assessment_id,
    submitted_by,
    submitted_at,
    result_count,
    absent_count
  ) values (
    target_assessment_id,
    auth.uid(),
    now(),
    result_count,
    absent_count
  )
  on conflict (assessment_id)
  do update set
    submitted_by = auth.uid(),
    submitted_at = now(),
    result_count = excluded.result_count,
    absent_count = excluded.absent_count
  returning id into submission_id;

  update public.assessment_events
  set
    operational_workflow_status = 'submitted',
    marks_submitted_at = now()
  where id = target_assessment_id;

  update public.assessment_events
  set
    operational_workflow_status = 'submitted',
    marks_submitted_at = now()
  where id in (
    select distinct sibling_ae.id
    from public.assessment_results res
    join public.student_unit_registrations sur
      on sur.student_id = res.student_id
     and sur.academic_period_id = target_period_id
     and sur.registration_status = 'registered'
    join public.assessment_events sibling_ae
      on sibling_ae.academic_period_id = target_period_id
     and sibling_ae.unit_id = sur.unit_id
    where res.assessment_event_id = target_assessment_id
  );

  return jsonb_build_object(
    'submissionId', submission_id,
    'assessmentId', target_assessment_id,
    'status', 'submitted',
    'resultCount', result_count,
    'absentCount', absent_count
  );
end;
$$;

revoke all on function public.submit_assessment_online_marks(uuid) from public;
grant execute on function public.submit_assessment_online_marks(uuid) to authenticated;

-- 8. Upgrade save_assessment_component_with_trainer_invite to ignore unregistered roster rows
create or replace function public.save_assessment_component_with_trainer_invite(
  target_token_hash text,
  target_component text,
  target_entries jsonb,
  submit_component boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_invite public.assessment_trainer_mark_invites%rowtype;
  selected_event public.assessment_events%rowtype;
  merged_entries jsonb;
  result jsonb;
  v_submitted_at timestamptz;
  sibling_event_ids uuid[];
  sib_id uuid;
begin
  if target_token_hash is null or char_length(trim(target_token_hash)) = 0 then
    raise exception 'A valid trainer invitation token is required.' using errcode = '42501';
  end if;

  select *
  into selected_invite
  from public.assessment_trainer_mark_invites
  where token_hash = target_token_hash;

  if selected_invite.id is null then
    raise exception 'The trainer invitation was not found.' using errcode = 'P0002';
  end if;

  if selected_invite.revoked_at is not null or selected_invite.expires_at <= now() then
    raise exception 'This trainer invitation link has expired or was revoked.' using errcode = '42501';
  end if;

  if target_component is null or target_component not in ('all', 'assignment', 'presentation', 'rat', 'cat', 'exam') then
    raise exception 'Choose an assessment component to save.' using errcode = '22023';
  end if;

  select *
  into selected_event
  from public.assessment_events
  where id = selected_invite.assessment_id;

  if selected_event.id is null then
    raise exception 'The associated markbook event was not found.' using errcode = 'P0002';
  end if;

  if selected_event.status = 'closed' then
    raise exception 'Mark entry for this unit markbook has been closed by administration.' using errcode = '23514';
  end if;

  if target_component = 'cat' and not (coalesce(selected_event.trainer_cat_entry_open, selected_event.trainer_entry_open, false)) then
    raise exception 'Continuous assessment mark entry is closed.' using errcode = '23514';
  end if;

  if target_component in ('all', 'exam') and not (coalesce(selected_event.trainer_exam_entry_open, false)) then
    raise exception 'Final examination mark entry is closed.' using errcode = '23514';
  end if;

  if submit_component and exists (
    select 1
    from public.assessment_mark_component_submissions submission
    where submission.assessment_id = selected_invite.assessment_id
      and submission.cohort_id is not distinct from selected_invite.cohort_id
      and submission.component_key = target_component
  ) then
    raise exception 'This component has already been submitted for this cohort.' using errcode = '23514';
  end if;

  if submit_component and exists (
    select 1
    from public.assessment_roster roster
    join public.students student on student.id = roster.student_id
    where roster.assessment_id = selected_invite.assessment_id
      and (selected_invite.cohort_id is null or roster.cohort_id = selected_invite.cohort_id)
      and student.lifecycle_status in ('admitted', 'active')
      and coalesce(student.academic_phase, 'in_class') = 'in_class'
      and public.student_is_registered_for_unit_or_sibling(
        student.id,
        selected_event.academic_period_id,
        selected_event.unit_id
      )
      and not exists (
        select 1 from jsonb_to_recordset(target_entries) as item(student_id uuid)
        where item.student_id = roster.student_id
      )
  ) then
    raise exception 'Include every student in this cohort before submitting its component.' using errcode = '23514';
  end if;

  merged_entries := public.build_assessment_mark_component_entries(
    selected_invite.assessment_id, selected_invite.cohort_id, target_component, target_entries
  );

  if submit_component and exists (
    select 1
    from jsonb_to_recordset(merged_entries) as item(
      student_id uuid, assignment numeric, presentation numeric, rat numeric, cat numeric, exam numeric
    )
    join public.assessment_roster roster
      on roster.assessment_id = selected_invite.assessment_id and roster.student_id = item.student_id
    join public.students student on student.id = roster.student_id
    where student.lifecycle_status in ('admitted', 'active')
      and coalesce(student.academic_phase, 'in_class') = 'in_class'
      and public.student_is_registered_for_unit_or_sibling(
        student.id,
        selected_event.academic_period_id,
        selected_event.unit_id
      )
      and (
        (target_component = 'assignment' and item.assignment is null)
        or (target_component = 'presentation' and item.presentation is null)
        or (target_component = 'rat' and item.rat is null)
        or (target_component = 'cat' and item.cat is null)
        or (target_component = 'exam' and roster.pre_assessment_status = 'expected' and item.exam is null)
      )
  ) then
    raise exception 'Complete this component for the selected students before submitting.' using errcode = '23514';
  end if;

  result := public.save_assessment_marks_with_trainer_invite(
    target_token_hash, merged_entries, false
  );

  if submit_component then
    select coalesce(array_agg(distinct sibling_id), array[selected_invite.assessment_id])
    into sibling_event_ids
    from (
      select selected_invite.assessment_id as sibling_id
      union
      select ae_sib.id as sibling_id
      from public.assessment_events ae_target
      join public.unit_offerings uo_target
        on uo_target.unit_id = ae_target.unit_id
       and uo_target.academic_period_id = ae_target.academic_period_id
       and uo_target.confirmed_shared_offering_id is not null
      join public.unit_offerings uo_sib
        on uo_sib.confirmed_shared_offering_id = uo_target.confirmed_shared_offering_id
       and uo_sib.academic_period_id = uo_target.academic_period_id
      join public.assessment_events ae_sib
        on ae_sib.unit_id = uo_sib.unit_id
       and ae_sib.academic_period_id = uo_sib.academic_period_id
       and ae_sib.assessment_type = 'exam'
      where ae_target.id = selected_invite.assessment_id
      union
      select ae_sib.id as sibling_id
      from public.assessment_events ae_target
      join public.unit_equivalence_members eq_target
        on eq_target.unit_id = ae_target.unit_id
       and eq_target.status = 'approved'
      join public.unit_equivalence_members eq_sib
        on eq_sib.equivalence_group_id = eq_target.equivalence_group_id
       and eq_sib.status = 'approved'
      join public.assessment_events ae_sib
        on ae_sib.unit_id = eq_sib.unit_id
       and ae_sib.academic_period_id = ae_target.academic_period_id
       and ae_sib.assessment_type = 'exam'
      where ae_target.id = selected_invite.assessment_id
    ) s;

    foreach sib_id in array sibling_event_ids loop
      insert into public.assessment_mark_component_submissions (
        assessment_id, cohort_id, component_key, source_trainer_invite_id
      ) values (
        sib_id, selected_invite.cohort_id, target_component, selected_invite.id
      )
      on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key) do nothing;

      if target_component = 'cat' then
        update public.assessment_events
        set cat_marks_finalized_at = coalesce(cat_marks_finalized_at, now())
        where id = sib_id;
      end if;
    end loop;

    insert into public.assessment_trainer_mark_invite_activity (
      invite_id, assessment_id, action, row_count
    ) values (
      selected_invite.id, selected_invite.assessment_id, 'submitted', jsonb_array_length(merged_entries)
    );
  end if;

  select submission.submitted_at into v_submitted_at
  from public.assessment_mark_component_submissions submission
  where submission.assessment_id = selected_invite.assessment_id
    and submission.cohort_id is not distinct from selected_invite.cohort_id
    and submission.component_key = target_component;

  return jsonb_build_object(
    'status', case when submit_component then 'submitted' else 'draft' end,
    'component', target_component,
    'submitted_at', v_submitted_at,
    'saved_count', jsonb_array_length(merged_entries)
  );
end;
$$;

revoke all on function public.save_assessment_component_with_trainer_invite(text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_assessment_component_with_trainer_invite(text, text, jsonb, boolean) to service_role;

-- 9. Upgrade HOD/Department attendance workspace RPCs to exclude unregistered students
create or replace function public.get_department_class_attendance_workspace(
  target_class_session_id uuid
)
returns table (
  class_session_id uuid,
  session_date date,
  session_status text,
  academic_period_name text,
  unit_name text,
  cohort_names text,
  trainer_name text,
  starts_at time without time zone,
  ends_at time without time zone,
  student_id uuid,
  admission_number text,
  full_name text,
  cohort_name text,
  attendance_status text,
  note text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  active_department uuid;
begin
  active_department = public.current_user_primary_department_id();

  if active_department is null
     or not public.current_user_can_manage_department(active_department)
  then
    raise exception 'No manageable active department is available.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.class_sessions as session
    join public.class_attendance_entries as entry on entry.class_session_id = session.id
    join public.cohorts as cohort on cohort.id = entry.cohort_id
    join public.programmes as programme on programme.id = cohort.programme_id
    where session.id = target_class_session_id
      and programme.department_id = active_department
  ) then
    raise exception 'Class attendance session was not found in the active department.' using errcode = 'P0002';
  end if;

  return query
  select
    session.id,
    session.session_date,
    session.status,
    period.name,
    unit.name,
    (
      select string_agg(distinct department_cohort.name, ' / ' order by department_cohort.name)
      from public.class_attendance_entries as department_entry
      join public.cohorts as department_cohort on department_cohort.id = department_entry.cohort_id
      join public.programmes as department_programme on department_programme.id = department_cohort.programme_id
      where department_entry.class_session_id = session.id
        and department_programme.department_id = active_department
        and public.student_is_registered_for_unit_or_sibling(
          department_entry.student_id,
          session.academic_period_id,
          session.unit_id
        )
    ),
    trainer.full_name,
    session.starts_at,
    session.ends_at,
    student.id,
    student.admission_number,
    student.full_name,
    cohort.name,
    entry.attendance_status,
    entry.note
  from public.class_sessions as session
  join public.academic_periods as period on period.id = session.academic_period_id
  join public.units as unit on unit.id = session.unit_id
  join public.trainers as trainer on trainer.id = session.trainer_id
  join public.class_attendance_entries as entry on entry.class_session_id = session.id
  join public.students as student on student.id = entry.student_id
  join public.cohorts as cohort on cohort.id = entry.cohort_id
  join public.programmes as programme on programme.id = cohort.programme_id
  where session.id = target_class_session_id
    and programme.department_id = active_department
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(student.academic_phase, 'in_class') = 'in_class'
    and public.student_is_registered_for_unit_or_sibling(
      student.id,
      session.academic_period_id,
      session.unit_id
    )
  order by cohort.name, student.full_name, student.admission_number;
end;
$$;

revoke all on function public.get_department_class_attendance_workspace(uuid) from public;
grant execute on function public.get_department_class_attendance_workspace(uuid) to authenticated;

create or replace function public.get_hod_class_attendance_workspace(
  target_class_session_id uuid
)
returns table (
  class_session_id uuid,
  teaching_allocation_id uuid,
  session_date date,
  session_status text,
  academic_period_name text,
  unit_name text,
  cohort_name text,
  trainer_name text,
  starts_at time without time zone,
  ends_at time without time zone,
  roster_count integer,
  student_id uuid,
  admission_number text,
  full_name text,
  attendance_status text,
  note text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_can_manage_class_session(target_class_session_id) then
    raise exception 'This attendance session is outside your active department.' using errcode = '42501';
  end if;

  return query
  select
    session.id,
    session.teaching_allocation_id,
    session.session_date,
    session.status,
    period.name,
    unit.name,
    cohort.name,
    trainer.full_name,
    session.starts_at,
    session.ends_at,
    session.roster_count,
    student.id,
    student.admission_number,
    student.full_name,
    entry.attendance_status,
    entry.note
  from public.class_sessions as session
  join public.academic_periods as period on period.id = session.academic_period_id
  join public.units as unit on unit.id = session.unit_id
  join public.cohorts as cohort on cohort.id = session.cohort_id
  join public.trainers as trainer on trainer.id = session.trainer_id
  join public.class_attendance_entries as entry on entry.class_session_id = session.id
  join public.students as student on student.id = entry.student_id
  where session.id = target_class_session_id
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(student.academic_phase, 'in_class') = 'in_class'
    and public.student_is_registered_for_unit_or_sibling(
      student.id,
      session.academic_period_id,
      session.unit_id
    )
  order by student.full_name, student.admission_number;
end;
$$;

revoke all on function public.get_hod_class_attendance_workspace(uuid) from public;
grant execute on function public.get_hod_class_attendance_workspace(uuid) to authenticated;

commit;
