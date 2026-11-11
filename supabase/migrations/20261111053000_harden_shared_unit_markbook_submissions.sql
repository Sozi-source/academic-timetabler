-- ============================================================================
-- Migration: Harden Shared Unit Markbook Submissions and Sibling Reconciliation
-- 
-- 1. Propagates component submissions (e.g. CAT) across all sibling assessment
--    events in the same approved equivalence group or confirmed shared offering.
-- 2. Propagates cat_marks_finalized_at timestamps to all sibling assessment events.
-- 3. Reconciles existing sibling events so stuck "1/2 Submitted" units are resolved.
-- ============================================================================

-- 1. Upgrade save_assessment_online_component_marks to synchronize sibling events
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
  if submit_component and exists (
    select 1
    from (select distinct roster.cohort_id from public.assessment_roster roster
          join jsonb_to_recordset(target_entries) as item(student_id uuid)
            on item.student_id = roster.student_id
          where roster.assessment_id = target_assessment_id) selected_cohorts
    join public.assessment_roster roster
      on roster.assessment_id = target_assessment_id
     and roster.cohort_id is not distinct from selected_cohorts.cohort_id
    where not exists (
      select 1 from jsonb_to_recordset(target_entries) as item(student_id uuid)
      where item.student_id = roster.student_id
    )
  ) then
    raise exception 'Include every student in a cohort before submitting its component.' using errcode = '23514';
  end if;

  merged_entries := public.build_assessment_mark_component_entries(
    target_assessment_id, null, target_component, target_entries
  );

  -- Keep CAT absence as an explicit roster status. This update and the mark
  -- submission share the same transaction because both happen in this RPC.
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
    where (target_component = 'assignment' and item.assignment is null)
       or (target_component = 'presentation' and item.presentation is null)
       or (target_component = 'rat' and item.rat is null)
       or (target_component = 'cat' and item.cat is null and not roster.cat_absent)
       or (target_component = 'exam' and roster.pre_assessment_status = 'expected' and item.exam is null)
  ) then
    raise exception 'Complete this component for the selected students before submitting.' using errcode = '23514';
  end if;

  result := public.save_assessment_online_marks(target_assessment_id, merged_entries);

  if submit_component then
    -- Discover target event + sibling events in shared offerings or approved equivalence groups
    select coalesce(array_agg(distinct sibling_id), array[target_assessment_id])
    into sibling_event_ids
    from (
      select target_assessment_id as sibling_id
      union
      -- Shared offerings
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
      -- Approved unit equivalence groups
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

    -- Record component submission across target and all sibling assessment events
    foreach sib_id in array sibling_event_ids loop
      insert into public.assessment_mark_component_submissions (
        assessment_id, cohort_id, component_key, submitted_by
      )
      select sib_id, cohort_id, target_component, auth.uid()
      from unnest(submission_cohorts) as cohort_id
      on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key) do nothing;

      -- Also ensure global cohort fallback entry
      insert into public.assessment_mark_component_submissions (
        assessment_id, cohort_id, component_key, submitted_by
      )
      values (sib_id, null, target_component, auth.uid())
      on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key) do nothing;

      -- Maintain cat_marks_finalized_at on assessment_events
      if target_component = 'cat' then
        update public.assessment_events
        set cat_marks_finalized_at = coalesce(cat_marks_finalized_at, now())
        where id = sib_id;
      end if;
    end loop;

    select not exists (
      select 1
      from (select distinct cohort_id from public.assessment_roster where assessment_id = target_assessment_id) cohorts
      cross join unnest(array['assignment', 'presentation', 'rat', 'cat', 'exam']::text[]) components(component_key)
      where not exists (
        select 1 from public.assessment_mark_component_submissions submission
        where submission.assessment_id = target_assessment_id
          and submission.cohort_id is not distinct from cohorts.cohort_id
          and submission.component_key = components.component_key
      )
    ) into final_ready;

    if final_ready then
      foreach sib_id in array sibling_event_ids loop
        perform public.submit_assessment_online_marks(sib_id);
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'status', case when submit_component then 'submitted' else 'draft' end,
    'component', target_component,
    'saved_count', jsonb_array_length(merged_entries)
  );
end;
$$;

revoke all on function public.save_assessment_online_component_marks(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.save_assessment_online_component_marks(uuid, text, jsonb, boolean) to authenticated;

-- 2. Upgrade save_assessment_component_with_trainer_invite to set cat_marks_finalized_at and sync siblings
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
    select 1 from public.assessment_roster roster
    where roster.assessment_id = selected_invite.assessment_id
      and (selected_invite.cohort_id is null or roster.cohort_id = selected_invite.cohort_id)
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
    where (target_component = 'assignment' and item.assignment is null)
       or (target_component = 'presentation' and item.presentation is null)
       or (target_component = 'rat' and item.rat is null)
       or (target_component = 'cat' and item.cat is null)
       or (target_component = 'exam' and roster.pre_assessment_status = 'expected' and item.exam is null)
  ) then
    raise exception 'Complete this component for the selected students before submitting.' using errcode = '23514';
  end if;

  result := public.save_assessment_marks_with_trainer_invite(
    target_token_hash, merged_entries, false
  );

  if submit_component then
    -- Discover sibling events
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

-- 3. Historical Data Reconciliation: heal any existing stuck markbooks in production
-- A. Synchronize cat_marks_finalized_at across approved equivalences & shared offerings
with sibling_pairs as (
  select distinct ae1.id as source_id, ae2.id as target_id
  from public.assessment_events ae1
  join public.unit_equivalence_members eq1 on eq1.unit_id = ae1.unit_id and eq1.status = 'approved'
  join public.unit_equivalence_members eq2 on eq2.equivalence_group_id = eq1.equivalence_group_id and eq2.status = 'approved'
  join public.assessment_events ae2 on ae2.unit_id = eq2.unit_id and ae2.academic_period_id = ae1.academic_period_id
  where ae1.id <> ae2.id
  union
  select distinct ae1.id as source_id, ae2.id as target_id
  from public.assessment_events ae1
  join public.unit_offerings uo1 on uo1.unit_id = ae1.unit_id and uo1.academic_period_id = ae1.academic_period_id and uo1.confirmed_shared_offering_id is not null
  join public.unit_offerings uo2 on uo2.confirmed_shared_offering_id = uo1.confirmed_shared_offering_id and uo2.academic_period_id = ae1.academic_period_id
  join public.assessment_events ae2 on ae2.unit_id = uo2.unit_id and ae2.academic_period_id = ae1.academic_period_id
  where ae1.id <> ae2.id
)
update public.assessment_events target
set cat_marks_finalized_at = coalesce(target.cat_marks_finalized_at, source.cat_marks_finalized_at)
from sibling_pairs sp
join public.assessment_events source on source.id = sp.source_id
where target.id = sp.target_id
  and source.cat_marks_finalized_at is not null
  and target.cat_marks_finalized_at is null;

-- B. Reconcile component submissions across sibling events
with sibling_pairs as (
  select distinct ae1.id as source_id, ae2.id as target_id
  from public.assessment_events ae1
  join public.unit_equivalence_members eq1 on eq1.unit_id = ae1.unit_id and eq1.status = 'approved'
  join public.unit_equivalence_members eq2 on eq2.equivalence_group_id = eq1.equivalence_group_id and eq2.status = 'approved'
  join public.assessment_events ae2 on ae2.unit_id = eq2.unit_id and ae2.academic_period_id = ae1.academic_period_id
  where ae1.id <> ae2.id
  union
  select distinct ae1.id as source_id, ae2.id as target_id
  from public.assessment_events ae1
  join public.unit_offerings uo1 on uo1.unit_id = ae1.unit_id and uo1.academic_period_id = ae1.academic_period_id and uo1.confirmed_shared_offering_id is not null
  join public.unit_offerings uo2 on uo2.confirmed_shared_offering_id = uo1.confirmed_shared_offering_id and uo2.academic_period_id = ae1.academic_period_id
  join public.assessment_events ae2 on ae2.unit_id = uo2.unit_id and ae2.academic_period_id = ae1.academic_period_id
  where ae1.id <> ae2.id
)
insert into public.assessment_mark_component_submissions (
  assessment_id, cohort_id, component_key, submitted_by, submitted_at
)
select sp.target_id, sub.cohort_id, sub.component_key, sub.submitted_by, sub.submitted_at
from sibling_pairs sp
join public.assessment_mark_component_submissions sub on sub.assessment_id = sp.source_id
on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key) do nothing;
