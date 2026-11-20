-- Fix unlock_assessment_mark_component_submission when unlocking all cohorts (target_cohort_id IS NULL)
-- and include confirmed shared offerings alongside approved unit equivalence groups.
--
-- Previously:
--   AND submission.cohort_id IS NOT DISTINCT FROM target_cohort_id
-- When target_cohort_id was NULL ("all cohorts"), IS NOT DISTINCT FROM only matched
-- rows where submission.cohort_id IS NULL, leaving every per-cohort submission row intact.
-- As a result, clicking "Unlock CAT" left CAT locked and still displayed as Submitted.

create or replace function public.unlock_assessment_mark_component_submission(
  target_assessment_id uuid,
  target_cohort_id uuid,
  target_component_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assessment_department_id uuid;
  assessment_unit_id uuid;
  assessment_period_id uuid;
  assessment_type_val text;
  sibling_event_ids uuid[] := array[]::uuid[];
  event_id uuid;
begin
  if auth.uid() is null
     or not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[])
  then
    raise exception 'Only an HOD or system administrator may unlock submitted marks.'
      using errcode = '42501';
  end if;

  if target_component_key not in ('assignment', 'presentation', 'rat', 'cat', 'exam') then
    raise exception 'Select a valid mark component.' using errcode = '22023';
  end if;

  select event.department_id, event.unit_id, event.academic_period_id, event.assessment_type
  into assessment_department_id, assessment_unit_id, assessment_period_id, assessment_type_val
  from public.assessment_events event
  where event.id = target_assessment_id;

  if not found then
    raise exception 'Assessment was not found.' using errcode = 'P0002';
  end if;

  if not public.current_user_can_manage_department(assessment_department_id) then
    raise exception 'This assessment is outside your working department.' using errcode = '42501';
  end if;

  -- Collect target + sibling assessment event IDs (shared offerings + approved equivalences)
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
     and ae_sib.assessment_type = assessment_type_val
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
     and ae_sib.assessment_type = assessment_type_val
    where ae_target.id = target_assessment_id
  ) s;

  if sibling_event_ids is null or array_length(sibling_event_ids, 1) = 0 then
    sibling_event_ids := array[target_assessment_id];
  end if;

  -- Delete component submission records across all siblings.
  -- When target_cohort_id is NULL, unlock all cohorts (including global NULL rows).
  -- When target_cohort_id is specified, unlock that cohort and remove any global NULL fallback row.
  delete from public.assessment_mark_component_submissions submission
  where submission.assessment_id = any(sibling_event_ids)
    and submission.component_key = target_component_key
    and (
      target_cohort_id is null
      or submission.cohort_id = target_cohort_id
      or submission.cohort_id is null
    );

  -- Reset relevant event timestamps and status
  foreach event_id in array sibling_event_ids loop
    if target_component_key = 'cat' then
      update public.assessment_events
      set cat_marks_finalized_at = null,
          marks_submitted_at = null,
          updated_at = now()
      where id = event_id;
    elsif target_component_key = 'exam' then
      update public.assessment_events
      set exam_marks_finalized_at = null,
          finalised_at = null,
          marks_submitted_at = null,
          status = 'open',
          operational_workflow_status = 'open',
          updated_at = now()
      where id = event_id;

      update public.assessment_roster
      set pre_assessment_status = 'expected'
      where assessment_id = event_id
        and pre_assessment_status = 'absent'
        and (target_cohort_id is null or cohort_id = target_cohort_id);

      update public.assessment_population
      set attendance_status = 'present'::public.assessment_attendance_status
      where assessment_event_id = event_id
        and attendance_status = 'absent'::public.assessment_attendance_status;
    end if;
  end loop;
end;
$$;

revoke all on function public.unlock_assessment_mark_component_submission(uuid, uuid, text) from public, anon;
grant execute on function public.unlock_assessment_mark_component_submission(uuid, uuid, text) to authenticated;
