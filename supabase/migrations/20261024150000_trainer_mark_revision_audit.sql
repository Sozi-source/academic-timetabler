-- ============================================================================
-- Migration: Trainer Mark Revision & Self-Unlock Audit Trail (Approach 2)
--
-- Allows trainers to revise/unlock previously submitted mark components while
-- department marks entry remains open (before HOD finalisation), with full
-- audit logging.
-- ============================================================================

create table if not exists public.assessment_mark_revisions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment_events(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  component_key text not null check (component_key in ('assignment', 'presentation', 'rat', 'cat', 'exam', 'all')),
  unlocked_by_user_id uuid references auth.users(id) on delete set null,
  unlocked_by_name text not null,
  reason text not null check (char_length(trim(reason)) >= 3),
  created_at timestamptz not null default now()
);

create index if not exists assessment_mark_revisions_assessment_idx
  on public.assessment_mark_revisions (assessment_id, created_at desc);

alter table public.assessment_mark_revisions enable row level security;
grant all on table public.assessment_mark_revisions to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Function: reopen_assessment_component_submission (for authenticated staff/trainers)
-- ----------------------------------------------------------------------------
create or replace function public.reopen_assessment_component_submission(
  p_assessment_id uuid,
  p_cohort_id uuid default null,
  p_component_key text default 'all',
  p_reason text default 'Correction of entered marks',
  p_unlocked_by_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_event public.assessment_events%rowtype;
  deleted_count integer := 0;
begin
  select * into target_event
  from public.assessment_events
  where id = p_assessment_id;

  if not found then
    raise exception 'The markbook was not found.' using errcode = 'P0002';
  end if;

  if not target_event.trainer_entry_open then
    raise exception 'Marks entry is currently locked by the department administration.' using errcode = '42501';
  end if;

  if target_event.status = 'closed' or target_event.exam_marks_finalized_at is not null then
    raise exception 'This markbook has been finalised and can no longer be revised.' using errcode = '23514';
  end if;

  -- Delete component submission record to unlock editing
  delete from public.assessment_mark_component_submissions
  where assessment_id = p_assessment_id
    and (p_cohort_id is null or cohort_id = p_cohort_id)
    and (p_component_key = 'all' or component_key = p_component_key);

  get diagnostics deleted_count = row_count;

  -- If this event had marks_submitted_at, reset it back to null
  update public.assessment_events
  set marks_submitted_at = null,
      updated_at = now()
  where id = p_assessment_id
    and marks_submitted_at is not null;

  -- Log revision audit
  insert into public.assessment_mark_revisions (
    assessment_id,
    cohort_id,
    component_key,
    unlocked_by_user_id,
    unlocked_by_name,
    reason
  ) values (
    p_assessment_id,
    p_cohort_id,
    p_component_key,
    auth.uid(),
    coalesce(p_unlocked_by_name, 'Trainer'),
    p_reason
  );

  return jsonb_build_object(
    'success', true,
    'assessmentId', p_assessment_id,
    'component', p_component_key,
    'deletedSubmissionsCount', deleted_count
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Function: reopen_assessment_component_with_trainer_invite (for link-based access)
-- ----------------------------------------------------------------------------
create or replace function public.reopen_assessment_component_with_trainer_invite(
  target_token_hash text,
  target_cohort_id uuid default null,
  target_component text default 'all',
  target_reason text default 'Correction of entered marks'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_invite public.assessment_trainer_mark_invites%rowtype;
  target_event public.assessment_events%rowtype;
  deleted_count integer := 0;
begin
  select * into selected_invite
  from public.assessment_trainer_mark_invites
  where token_hash = target_token_hash;

  if not found or selected_invite.revoked_at is not null or selected_invite.expires_at <= now() then
    raise exception 'This trainer link is invalid or expired.' using errcode = '42501';
  end if;

  select * into target_event
  from public.assessment_events
  where id = selected_invite.assessment_id;

  if not found then
    raise exception 'The markbook was not found.' using errcode = 'P0002';
  end if;

  if not target_event.trainer_entry_open then
    raise exception 'Marks entry is currently locked by the department administration.' using errcode = '42501';
  end if;

  if target_event.status = 'closed' or target_event.exam_marks_finalized_at is not null then
    raise exception 'This markbook has been finalised and can no longer be revised.' using errcode = '23514';
  end if;

  -- Delete component submission record
  delete from public.assessment_mark_component_submissions
  where assessment_id = selected_invite.assessment_id
    and (target_cohort_id is null or cohort_id = target_cohort_id)
    and (target_component = 'all' or component_key = target_component);

  get diagnostics deleted_count = row_count;

  -- Reset submitted_at on invite if present
  update public.assessment_trainer_mark_invites
  set submitted_at = null
  where id = selected_invite.id
     or parent_invite_id = selected_invite.id;

  -- Log revision audit
  insert into public.assessment_mark_revisions (
    assessment_id,
    cohort_id,
    component_key,
    unlocked_by_user_id,
    unlocked_by_name,
    reason
  ) values (
    selected_invite.assessment_id,
    coalesce(target_cohort_id, selected_invite.cohort_id),
    target_component,
    null,
    selected_invite.trainer_name,
    target_reason
  );

  return jsonb_build_object(
    'success', true,
    'assessmentId', selected_invite.assessment_id,
    'component', target_component,
    'deletedSubmissionsCount', deleted_count
  );
end;
$$;
