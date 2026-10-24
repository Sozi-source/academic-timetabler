-- ============================================================================
-- Migration: Fix ambiguous submitted_at variable in save_assessment_component_with_trainer_invite
--
-- Why:
--   The PL/pgSQL function had a local variable `submitted_at timestamptz;`
--   which collided with the column name `submitted_at` in
--   `select submitted_at into submitted_at from assessment_mark_component_submissions`.
--   This caused PostgreSQL to fail with:
--   ERROR: column reference "submitted_at" is ambiguous (SQLSTATE 42702).
--
-- Fix:
--   Rename local variable to `v_submitted_at` and qualify table alias
--   `select submission.submitted_at into v_submitted_at`.
-- ============================================================================

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
  v_submitted_at timestamptz;
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

  select submission.submitted_at into v_submitted_at
  from public.assessment_mark_component_submissions submission
  where submission.assessment_id = selected_invite.assessment_id
    and submission.cohort_id is not distinct from selected_invite.cohort_id
    and submission.component_key = target_component;

  return jsonb_build_object(
    'status', case when submit_component then 'submitted' else 'draft' end,
    'component', target_component,
    'submittedAt', v_submitted_at,
    'savedCount', jsonb_array_length(merged_entries),
    'savedResult', result
  );
end;
$$;

revoke all on function public.save_assessment_component_with_trainer_invite(text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_assessment_component_with_trainer_invite(text, text, jsonb, boolean) to service_role;
