-- Migration: 20261111000000_sync_sibling_assessment_cat_submissions.sql
-- Synchronize CAT marks finalized timestamps and component submissions across sibling
-- assessment events in approved unit equivalence groups and confirmed shared offerings.

-- 1. Backfill cat_marks_finalized_at for existing sibling assessment events
with submitted_parents as (
  select
    e.id as parent_event_id,
    e.unit_id as parent_unit_id,
    e.academic_period_id,
    e.cat_marks_finalized_at
  from public.assessment_events e
  where e.cat_marks_finalized_at is not null
),
sibling_units as (
  select
    p.parent_event_id,
    p.academic_period_id,
    p.cat_marks_finalized_at,
    m2.unit_id as sibling_unit_id
  from submitted_parents p
  join public.unit_equivalence_members m1
    on m1.unit_id = p.parent_unit_id and m1.status = 'approved'
  join public.unit_equivalence_members m2
    on m2.equivalence_group_id = m1.equivalence_group_id and m2.status = 'approved'
  where m2.unit_id <> p.parent_unit_id
  union
  select
    p.parent_event_id,
    p.academic_period_id,
    p.cat_marks_finalized_at,
    o2.unit_id as sibling_unit_id
  from submitted_parents p
  join public.unit_offerings o1
    on o1.unit_id = p.parent_unit_id and o1.academic_period_id = p.academic_period_id and o1.confirmed_shared_offering_id is not null
  join public.unit_offerings o2
    on o2.confirmed_shared_offering_id = o1.confirmed_shared_offering_id and o2.academic_period_id = p.academic_period_id
  where o2.unit_id <> p.parent_unit_id
),
sibling_events as (
  select distinct
    e.id as sibling_event_id,
    su.parent_event_id,
    su.cat_marks_finalized_at
  from public.assessment_events e
  join sibling_units su
    on su.sibling_unit_id = e.unit_id and su.academic_period_id = e.academic_period_id
  where e.id <> su.parent_event_id
    and e.cat_marks_finalized_at is null
)
update public.assessment_events e
set cat_marks_finalized_at = se.cat_marks_finalized_at
from sibling_events se
where e.id = se.sibling_event_id;

-- 2. Backfill assessment_mark_component_submissions for sibling assessment events
with submitted_parents as (
  select
    e.id as parent_event_id,
    e.unit_id as parent_unit_id,
    e.academic_period_id
  from public.assessment_events e
  where e.cat_marks_finalized_at is not null
),
sibling_units as (
  select
    p.parent_event_id,
    p.academic_period_id,
    m2.unit_id as sibling_unit_id
  from submitted_parents p
  join public.unit_equivalence_members m1
    on m1.unit_id = p.parent_unit_id and m1.status = 'approved'
  join public.unit_equivalence_members m2
    on m2.equivalence_group_id = m1.equivalence_group_id and m2.status = 'approved'
  where m2.unit_id <> p.parent_unit_id
  union
  select
    p.parent_event_id,
    p.academic_period_id,
    o2.unit_id as sibling_unit_id
  from submitted_parents p
  join public.unit_offerings o1
    on o1.unit_id = p.parent_unit_id and o1.academic_period_id = p.academic_period_id and o1.confirmed_shared_offering_id is not null
  join public.unit_offerings o2
    on o2.confirmed_shared_offering_id = o1.confirmed_shared_offering_id and o2.academic_period_id = p.academic_period_id
  where o2.unit_id <> p.parent_unit_id
),
sibling_events as (
  select distinct
    e.id as sibling_event_id,
    su.parent_event_id
  from public.assessment_events e
  join sibling_units su
    on su.sibling_unit_id = e.unit_id and su.academic_period_id = e.academic_period_id
  where e.id <> su.parent_event_id
)
insert into public.assessment_mark_component_submissions (
  assessment_id,
  cohort_id,
  component_key,
  submitted_by,
  submitted_at
)
select
  se.sibling_event_id,
  sub.cohort_id,
  sub.component_key,
  sub.submitted_by,
  sub.submitted_at
from sibling_events se
join public.assessment_mark_component_submissions sub
  on sub.assessment_id = se.parent_event_id
on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key)
do update set
  submitted_at = excluded.submitted_at,
  submitted_by = excluded.submitted_by;

-- 3. Update save_assessment_online_component_marks to automatically synchronize siblings
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
    select array_agg(distinct roster.cohort_id) into submission_cohorts
    from jsonb_to_recordset(merged_entries) as item(student_id uuid)
    join public.assessment_roster roster
      on roster.assessment_id = target_assessment_id and roster.student_id = item.student_id;

    insert into public.assessment_mark_component_submissions (
      assessment_id, cohort_id, component_key, submitted_by
    )
    select target_assessment_id, cohort_id, target_component, auth.uid()
    from unnest(submission_cohorts) as cohort_id
    on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key) do nothing;

    -- Maintain cat_marks_finalized_at on assessment_events
    if target_component = 'cat' then
      update public.assessment_events
      set cat_marks_finalized_at = now()
      where id = target_assessment_id
        and cat_marks_finalized_at is null;

      -- Synchronize cat_marks_finalized_at and component submissions to sibling assessment events
      with target_info as (
        select unit_id, academic_period_id from public.assessment_events where id = target_assessment_id
      ),
      sibling_units as (
        select m2.unit_id
        from target_info t
        join public.unit_equivalence_members m1 on m1.unit_id = t.unit_id and m1.status = 'approved'
        join public.unit_equivalence_members m2 on m2.equivalence_group_id = m1.equivalence_group_id and m2.status = 'approved'
        union
        select o2.unit_id
        from target_info t
        join public.unit_offerings o1 on o1.unit_id = t.unit_id and o1.academic_period_id = t.academic_period_id and o1.confirmed_shared_offering_id is not null
        join public.unit_offerings o2 on o2.confirmed_shared_offering_id = o1.confirmed_shared_offering_id and o2.academic_period_id = t.academic_period_id
      ),
      sibling_events as (
        select e.id as sibling_event_id
        from public.assessment_events e
        join target_info t on t.academic_period_id = e.academic_period_id
        join sibling_units su on su.unit_id = e.unit_id
        where e.id <> target_assessment_id
      )
      update public.assessment_events e
      set cat_marks_finalized_at = now()
      from sibling_events se
      where e.id = se.sibling_event_id
        and e.cat_marks_finalized_at is null;

      -- Insert component submission records for siblings
      with target_info as (
        select unit_id, academic_period_id from public.assessment_events where id = target_assessment_id
      ),
      sibling_units as (
        select m2.unit_id
        from target_info t
        join public.unit_equivalence_members m1 on m1.unit_id = t.unit_id and m1.status = 'approved'
        join public.unit_equivalence_members m2 on m2.equivalence_group_id = m1.equivalence_group_id and m2.status = 'approved'
        union
        select o2.unit_id
        from target_info t
        join public.unit_offerings o1 on o1.unit_id = t.unit_id and o1.academic_period_id = t.academic_period_id and o1.confirmed_shared_offering_id is not null
        join public.unit_offerings o2 on o2.confirmed_shared_offering_id = o1.confirmed_shared_offering_id and o2.academic_period_id = t.academic_period_id
      ),
      sibling_events as (
        select e.id as sibling_event_id
        from public.assessment_events e
        join target_info t on t.academic_period_id = e.academic_period_id
        join sibling_units su on su.unit_id = e.unit_id
        where e.id <> target_assessment_id
      )
      insert into public.assessment_mark_component_submissions (
        assessment_id, cohort_id, component_key, submitted_by
      )
      select se.sibling_event_id, c.cohort_id, target_component, auth.uid()
      from sibling_events se
      cross join unnest(submission_cohorts) as c(cohort_id)
      on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key) do nothing;
    end if;

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
      perform public.submit_assessment_online_marks(target_assessment_id);
    end if;
  end if;

  return jsonb_build_object(
    'status', case when submit_component then 'submitted' else 'draft' end,
    'component', target_component,
    'finalized', coalesce(final_ready, false),
    'savedCount', jsonb_array_length(merged_entries)
  );
end;
$$;

revoke all on function public.save_assessment_online_component_marks(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.save_assessment_online_component_marks(uuid, text, jsonb, boolean) to authenticated;
