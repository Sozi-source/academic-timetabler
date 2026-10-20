create table public.assessment_trainer_mark_invites (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment_events(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  trainer_name text not null,
  trainer_email text,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  submitted_at timestamptz,
  revoked_at timestamptz,
  constraint assessment_trainer_mark_invites_name_check
    check (char_length(trim(trainer_name)) between 2 and 120),
  constraint assessment_trainer_mark_invites_email_check
    check (trainer_email is null or char_length(trim(trainer_email)) <= 254),
  constraint assessment_trainer_mark_invites_token_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint assessment_trainer_mark_invites_expiry_check
    check (expires_at > created_at)
);

create index assessment_trainer_mark_invites_assessment_idx
  on public.assessment_trainer_mark_invites (assessment_id, created_at desc);

create table public.assessment_trainer_mark_invite_activity (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.assessment_trainer_mark_invites(id) on delete cascade,
  assessment_id uuid not null references public.assessment_events(id) on delete cascade,
  action text not null check (action in ('draft_saved', 'submitted')),
  row_count integer not null check (row_count >= 0),
  created_at timestamptz not null default now()
);

create index assessment_trainer_mark_invite_activity_invite_idx
  on public.assessment_trainer_mark_invite_activity (invite_id, created_at desc);

alter table public.assessment_online_mark_drafts
  add column source_trainer_invite_id uuid
    references public.assessment_trainer_mark_invites(id) on delete set null;

alter table public.assessment_trainer_mark_invites enable row level security;
alter table public.assessment_trainer_mark_invite_activity enable row level security;

revoke all on table public.assessment_trainer_mark_invites from anon, authenticated;
revoke all on table public.assessment_trainer_mark_invite_activity from anon, authenticated;
grant all on table public.assessment_trainer_mark_invites to service_role;
grant all on table public.assessment_trainer_mark_invite_activity to service_role;

create or replace function public.save_assessment_marks_with_trainer_invite(
  target_token_hash text,
  target_entries jsonb,
  submit_marks boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_invite public.assessment_trainer_mark_invites%rowtype;
  target_status text;
  target_type text;
  target_locked_at timestamptz;
  target_period_id uuid;
  target_unit_id uuid;
  configured_maximum numeric;
  entry_count integer := 0;
  roster_count integer := 0;
begin
  select * into selected_invite
  from public.assessment_trainer_mark_invites
  where token_hash = target_token_hash
  for update;

  if not found
     or selected_invite.revoked_at is not null
     or selected_invite.expires_at <= now()
  then
    raise exception 'This trainer link is invalid or expired.'
      using errcode = '42501';
  end if;

  if selected_invite.submitted_at is not null then
    raise exception 'Marks have already been submitted for this trainer link.'
      using errcode = '23514';
  end if;

  select
    workspace.workflow_status,
    workspace.assessment_type,
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
  where workspace.id = selected_invite.assessment_id;

  if not found then
    raise exception 'The markbook was not found.' using errcode = 'P0002';
  end if;

  if target_type <> 'exam' or target_locked_at is null then
    raise exception 'The markbook roster is not ready for external mark entry.'
      using errcode = '23514';
  end if;

  if target_status in ('submitted', 'finalised', 'archived') then
    raise exception 'This markbook no longer accepts marks.'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.assessment_events as event
    where event.id = selected_invite.assessment_id
      and (event.status = 'closed' or event.exam_marks_finalized_at is not null)
  ) then
    raise exception 'This markbook has been finalized and no longer accepts marks.'
      using errcode = '23514';
  end if;

  select rule.maximum_mark into configured_maximum
  from public.assessment_rules as rule
  where rule.academic_period_id = target_period_id
    and rule.unit_id = target_unit_id
    and rule.assessment_type = 'exam';

  if not found or configured_maximum <> 100 then
    raise exception 'The final assessment rule must be configured to 100 marks.'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.assessment_results as result
    where result.assessment_event_id = selected_invite.assessment_id
  ) then
    raise exception 'Committed results already exist for this markbook.'
      using errcode = '23505';
  end if;

  if target_entries is null or jsonb_typeof(target_entries) <> 'array' then
    raise exception 'Marks must be sent as a list.' using errcode = '22023';
  end if;

  select count(*)::integer into entry_count
  from jsonb_to_recordset(target_entries) as item(
    student_id uuid,
    assignment numeric,
    presentation numeric,
    rat numeric,
    cat numeric,
    exam numeric
  );

  if entry_count = 0 then
    raise exception 'Enter marks for at least one student.' using errcode = '22023';
  end if;

  if entry_count > 2000 then
    raise exception 'Too many students were included in one save.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(target_entries) as item(
      student_id uuid,
      assignment numeric,
      presentation numeric,
      rat numeric,
      cat numeric,
      exam numeric
    )
    where item.student_id is null
      or (item.assignment is not null and item.assignment not between 0 and 5)
      or (item.presentation is not null and item.presentation not between 0 and 10)
      or (item.rat is not null and item.rat not between 0 and 15)
      or (item.cat is not null and item.cat not between 0 and 15)
      or (item.exam is not null and item.exam not between 0 and 70)
  ) then
    raise exception 'One or more marks exceed the allowed component range.'
      using errcode = '23514';
  end if;

  if entry_count <> (
    select count(distinct item.student_id)::integer
    from jsonb_to_recordset(target_entries) as item(
      student_id uuid,
      assignment numeric,
      presentation numeric,
      rat numeric,
      cat numeric,
      exam numeric
    )
  ) then
    raise exception 'Duplicate students were found in the marks.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(target_entries) as item(
      student_id uuid,
      assignment numeric,
      presentation numeric,
      rat numeric,
      cat numeric,
      exam numeric
    )
    where not exists (
      select 1 from public.assessment_roster as roster
      where roster.assessment_id = selected_invite.assessment_id
        and roster.student_id = item.student_id
    )
  ) then
    raise exception 'Marks can only be entered for students in this markbook roster.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(target_entries) as item(
      student_id uuid,
      assignment numeric,
      presentation numeric,
      rat numeric,
      cat numeric,
      exam numeric
    )
    join public.assessment_roster as roster
      on roster.assessment_id = selected_invite.assessment_id
     and roster.student_id = item.student_id
    where roster.pre_assessment_status = 'absent'
      and item.exam is not null
  ) then
    raise exception 'A student marked absent must keep AB for the Exam mark.'
      using errcode = '23514';
  end if;

  if submit_marks then
    select count(*)::integer into roster_count
    from public.assessment_roster as roster
    where roster.assessment_id = selected_invite.assessment_id;

    if entry_count <> roster_count or exists (
      select 1
      from public.assessment_roster as roster
      left join jsonb_to_recordset(target_entries) as item(
        student_id uuid,
        assignment numeric,
        presentation numeric,
        rat numeric,
        cat numeric,
        exam numeric
      ) on item.student_id = roster.student_id
      where roster.assessment_id = selected_invite.assessment_id
        and (
          item.student_id is null
          or item.assignment is null
          or item.presentation is null
          or item.rat is null
          or item.cat is null
          or (roster.pre_assessment_status = 'expected' and item.exam is null)
          or (roster.pre_assessment_status = 'absent' and item.exam is not null)
        )
    ) then
      raise exception 'Complete all required marks before submitting.'
        using errcode = '23514';
    end if;
  end if;

  insert into public.assessment_online_mark_drafts (
    assessment_id,
    student_id,
    cohort_id,
    assignment_mark,
    presentation_mark,
    rat_mark,
    cat_mark,
    exam_mark,
    updated_by,
    source_trainer_invite_id,
    updated_at
  )
  select
    selected_invite.assessment_id,
    item.student_id,
    roster.cohort_id,
    item.assignment,
    item.presentation,
    item.rat,
    item.cat,
    case when roster.pre_assessment_status = 'absent' then null else item.exam end,
    null,
    selected_invite.id,
    now()
  from jsonb_to_recordset(target_entries) as item(
    student_id uuid,
    assignment numeric,
    presentation numeric,
    rat numeric,
    cat numeric,
    exam numeric
  )
  join public.assessment_roster as roster
    on roster.assessment_id = selected_invite.assessment_id
   and roster.student_id = item.student_id
  on conflict (assessment_id, student_id) do update set
    cohort_id = excluded.cohort_id,
    assignment_mark = excluded.assignment_mark,
    presentation_mark = excluded.presentation_mark,
    rat_mark = excluded.rat_mark,
    cat_mark = excluded.cat_mark,
    exam_mark = excluded.exam_mark,
    updated_by = null,
    source_trainer_invite_id = selected_invite.id,
    updated_at = now();

  insert into public.assessment_trainer_mark_invite_activity (
    invite_id, assessment_id, action, row_count
  ) values (
    selected_invite.id,
    selected_invite.assessment_id,
    case when submit_marks then 'submitted' else 'draft_saved' end,
    entry_count
  );

  if submit_marks then
    update public.assessment_trainer_mark_invites
    set submitted_at = now()
    where id = selected_invite.id;
  end if;

  return jsonb_build_object(
    'assessmentId', selected_invite.assessment_id,
    'status', case when submit_marks then 'submitted' else 'draft' end,
    'savedCount', entry_count
  );
end;
$$;

revoke all on function public.save_assessment_marks_with_trainer_invite(text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.save_assessment_marks_with_trainer_invite(text, jsonb, boolean)
  to service_role;
