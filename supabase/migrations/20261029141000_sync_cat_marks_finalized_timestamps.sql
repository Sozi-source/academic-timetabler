-- Ensure assessment_events.cat_marks_finalized_at is kept in sync with CAT component submissions

-- Preserve confirmed CAT absence separately from a missing mark.
alter table public.assessment_roster
  add column if not exists cat_absent boolean not null default false;

-- Existing CAT submissions with a null CAT draft were already treated as AB
-- by the prior editor. Preserve that status during the transition.
update public.assessment_roster roster
set cat_absent = true
from public.assessment_mark_component_submissions submission
join public.assessment_online_mark_drafts draft
  on draft.assessment_id = submission.assessment_id
where submission.assessment_id = roster.assessment_id
  and submission.cohort_id is not distinct from roster.cohort_id
  and submission.component_key = 'cat'
  and draft.student_id = roster.student_id
  and draft.cat_mark is null;

-- 1. Backfill cat_marks_finalized_at for existing submitted CAT components
update public.assessment_events as e
set cat_marks_finalized_at = sub.max_submitted_at
from (
  select assessment_id, max(submitted_at) as max_submitted_at
  from public.assessment_mark_component_submissions
  where component_key = 'cat'
  group by assessment_id
) as sub
where e.id = sub.assessment_id
  and e.cat_marks_finalized_at is null;

-- 2. Update save_assessment_online_component_marks to automatically set cat_marks_finalized_at
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
