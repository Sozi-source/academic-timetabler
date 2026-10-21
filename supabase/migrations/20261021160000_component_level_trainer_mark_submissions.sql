create table public.assessment_mark_component_submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment_events(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  component_key text not null check (component_key in ('assignment', 'presentation', 'rat', 'cat', 'exam')),
  submitted_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null,
  source_trainer_invite_id uuid references public.assessment_trainer_mark_invites(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index assessment_mark_component_submissions_scope_unique
  on public.assessment_mark_component_submissions (
    assessment_id,
    coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid),
    component_key
  );

create index assessment_mark_component_submissions_cat_idx
  on public.assessment_mark_component_submissions (assessment_id, cohort_id)
  where component_key = 'cat';

alter table public.assessment_mark_component_submissions enable row level security;
revoke all on table public.assessment_mark_component_submissions from public, anon, authenticated;
grant all on table public.assessment_mark_component_submissions to service_role;
grant select on table public.assessment_mark_component_submissions to authenticated;
create policy assessment_mark_component_submissions_assessment_actor_read
  on public.assessment_mark_component_submissions
  for select to authenticated
  using (public.assessment_actor_can_manage_assessment(assessment_id));

create or replace function public.build_assessment_mark_component_entries(
  target_assessment_id uuid,
  target_cohort_id uuid,
  target_component text,
  target_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  merged_entries jsonb;
begin
  if target_component not in ('all', 'assignment', 'presentation', 'rat', 'cat', 'exam') then
    raise exception 'Select a valid mark component.' using errcode = '22023';
  end if;

  if target_entries is null or jsonb_typeof(target_entries) <> 'array' or jsonb_array_length(target_entries) = 0 then
    raise exception 'Marks must be sent as a list.' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'student_id', roster.student_id,
    'assignment', case
      when (target_component in ('all', 'assignment') and not exists (
        select 1 from public.assessment_mark_component_submissions submission
        where submission.assessment_id = target_assessment_id
          and submission.cohort_id is not distinct from roster.cohort_id
          and submission.component_key = 'assignment'
      )) then item.assignment else draft.assignment_mark end,
    'presentation', case
      when (target_component in ('all', 'presentation') and not exists (
        select 1 from public.assessment_mark_component_submissions submission
        where submission.assessment_id = target_assessment_id
          and submission.cohort_id is not distinct from roster.cohort_id
          and submission.component_key = 'presentation'
      )) then item.presentation else draft.presentation_mark end,
    'rat', case
      when (target_component in ('all', 'rat') and not exists (
        select 1 from public.assessment_mark_component_submissions submission
        where submission.assessment_id = target_assessment_id
          and submission.cohort_id is not distinct from roster.cohort_id
          and submission.component_key = 'rat'
      )) then item.rat else draft.rat_mark end,
    'cat', case
      when (target_component in ('all', 'cat') and not exists (
        select 1 from public.assessment_mark_component_submissions submission
        where submission.assessment_id = target_assessment_id
          and submission.cohort_id is not distinct from roster.cohort_id
          and submission.component_key = 'cat'
      )) then item.cat else draft.cat_mark end,
    'exam', case
      when (target_component in ('all', 'exam') and not exists (
        select 1 from public.assessment_mark_component_submissions submission
        where submission.assessment_id = target_assessment_id
          and submission.cohort_id is not distinct from roster.cohort_id
          and submission.component_key = 'exam'
      )) then item.exam else draft.exam_mark end
  ))
  into merged_entries
  from jsonb_to_recordset(target_entries) as item(
    student_id uuid,
    assignment numeric,
    presentation numeric,
    rat numeric,
    cat numeric,
    exam numeric
  )
  join public.assessment_roster roster
    on roster.assessment_id = target_assessment_id
   and roster.student_id = item.student_id
  left join public.assessment_online_mark_drafts draft
    on draft.assessment_id = roster.assessment_id
   and draft.student_id = roster.student_id
  where target_cohort_id is null or roster.cohort_id = target_cohort_id;

  if merged_entries is null or jsonb_array_length(merged_entries) = 0 then
    raise exception 'No submitted students belong to this markbook scope.' using errcode = '23514';
  end if;
  if jsonb_array_length(merged_entries) <> jsonb_array_length(target_entries) then
    raise exception 'One or more students are outside this markbook scope.' using errcode = '23514';
  end if;

  return merged_entries;
end;
$$;

revoke all on function public.build_assessment_mark_component_entries(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.build_assessment_mark_component_entries(uuid, uuid, text, jsonb) to service_role;

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
       or (target_component = 'cat' and item.cat is null)
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
  merged_entries jsonb;
  result jsonb;
  submitted_at timestamptz;
begin
  if target_component = 'all' and submit_component then
    raise exception 'Choose one component to submit.' using errcode = '22023';
  end if;
  select * into selected_invite
  from public.assessment_trainer_mark_invites
  where token_hash = target_token_hash
  for update;
  if not found or selected_invite.revoked_at is not null or selected_invite.expires_at <= now() then
    raise exception 'This trainer link is invalid or expired.' using errcode = '42501';
  end if;
  if selected_invite.submitted_at is not null then
    raise exception 'This legacy trainer link has already been submitted.' using errcode = '23514';
  end if;
  if submit_component and exists (
    select 1 from public.assessment_mark_component_submissions submission
    where submission.assessment_id = selected_invite.assessment_id
      and submission.component_key = target_component
      and submission.cohort_id is not distinct from selected_invite.cohort_id
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
    insert into public.assessment_mark_component_submissions (
      assessment_id, cohort_id, component_key, source_trainer_invite_id
    ) values (
      selected_invite.assessment_id, selected_invite.cohort_id, target_component, selected_invite.id
    );
    insert into public.assessment_trainer_mark_invite_activity (
      invite_id, assessment_id, action, row_count
    ) values (
      selected_invite.id, selected_invite.assessment_id, 'submitted', jsonb_array_length(merged_entries)
    );
  end if;

  select submitted_at into submitted_at
  from public.assessment_mark_component_submissions
  where assessment_id = selected_invite.assessment_id
    and cohort_id is not distinct from selected_invite.cohort_id
    and component_key = target_component;

  return jsonb_build_object(
    'status', case when submit_component then 'submitted' else 'draft' end,
    'component', target_component,
    'submittedAt', submitted_at,
    'savedCount', jsonb_array_length(merged_entries),
    'savedResult', result
  );
end;
$$;

revoke all on function public.save_assessment_component_with_trainer_invite(text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_assessment_component_with_trainer_invite(text, text, jsonb, boolean) to service_role;

comment on table public.assessment_mark_component_submissions is
  'Trainer submissions lock one marks component within one cohort; separate component submissions stay editable until the final result is complete.';
