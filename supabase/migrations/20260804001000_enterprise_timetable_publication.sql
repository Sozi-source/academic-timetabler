begin;

create table if not exists public.timetable_versions (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references public.academic_periods(id) on delete restrict,
  version_number integer not null,
  status text not null default 'draft',
  title text not null,
  change_summary text,
  session_count integer not null default 0,
  conflict_count integer not null default 0,
  snapshot jsonb not null default '[]'::jsonb,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_versions_status_check check (status in ('draft','under_review','approved','published','archived')),
  constraint timetable_versions_counts_check check (session_count >= 0 and conflict_count >= 0),
  constraint timetable_versions_period_version_unique unique (academic_period_id, version_number)
);

create unique index if not exists timetable_versions_one_published_per_period_idx
  on public.timetable_versions (academic_period_id)
  where status = 'published';

create index if not exists timetable_versions_period_created_idx
  on public.timetable_versions (academic_period_id, created_at desc);

create table if not exists public.timetable_publication_events (
  id uuid primary key default gen_random_uuid(),
  timetable_version_id uuid not null references public.timetable_versions(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text not null,
  note text,
  performed_by uuid references auth.users(id) on delete set null default auth.uid(),
  performed_at timestamptz not null default now(),
  constraint timetable_publication_events_type_check check (event_type in ('created','submitted','approved','published','archived','reopened'))
);

alter table public.timetable_versions enable row level security;
alter table public.timetable_publication_events enable row level security;

create policy "Authenticated users can view timetable versions"
on public.timetable_versions for select to authenticated using (true);

create policy "Authenticated users can view timetable publication events"
on public.timetable_publication_events for select to authenticated using (true);

create or replace function public.create_timetable_version(
  target_academic_period_id uuid,
  version_title text,
  version_change_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version integer;
  version_id uuid;
  sessions_total integer;
  blocked_total integer;
  version_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'You are not authorized to create timetable versions.';
  end if;
  if nullif(trim(version_title), '') is null then
    raise exception using errcode = '22023', message = 'A timetable version title is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('timetable-version:' || target_academic_period_id::text, 0));

  select count(*), count(*) filter (where conflict_state = 'blocked')
  into sessions_total, blocked_total
  from public.scheduled_sessions
  where academic_period_id = target_academic_period_id
    and status in ('draft','confirmed','locked');

  if sessions_total = 0 then
    raise exception using errcode = 'P0001', message = 'No draft timetable sessions are available to version.';
  end if;
  if blocked_total > 0 then
    raise exception using errcode = 'P0001', message = 'Resolve all blocking timetable conflicts before creating a version.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', session.id,
    'cohortId', session.cohort_id,
    'cohortName', cohort.name,
    'unitId', session.unit_id,
    'unitCode', unit.code,
    'unitName', unit.name,
    'trainerId', session.trainer_id,
    'trainerName', trainer.full_name,
    'roomId', session.room_id,
    'roomCode', room.code,
    'roomName', room.name,
    'workingDayId', session.working_day_id,
    'day', day.day_of_week,
    'daySequence', day.sequence_number,
    'startTimeSlotId', session.start_time_slot_id,
    'startTime', start_slot.starts_at,
    'endTimeSlotId', session.end_time_slot_id,
    'endTime', end_slot.ends_at,
    'sessionNumber', session.session_number,
    'deliveryMode', session.delivery_mode,
    'isLocked', session.is_locked,
    'notes', session.notes
  ) order by day.sequence_number, start_slot.sequence_number, cohort.name, unit.code), '[]'::jsonb)
  into version_snapshot
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.units unit on unit.id = session.unit_id
  join public.trainers trainer on trainer.id = session.trainer_id
  join public.rooms room on room.id = session.room_id
  join public.working_days day on day.id = session.working_day_id
  join public.time_slots start_slot on start_slot.id = session.start_time_slot_id
  join public.time_slots end_slot on end_slot.id = session.end_time_slot_id
  where session.academic_period_id = target_academic_period_id
    and session.status in ('draft','confirmed','locked');

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.timetable_versions where academic_period_id = target_academic_period_id;

  insert into public.timetable_versions (
    academic_period_id, version_number, status, title, change_summary,
    session_count, conflict_count, snapshot, created_by
  ) values (
    target_academic_period_id, next_version, 'draft', trim(version_title),
    nullif(trim(version_change_summary), ''), sessions_total, blocked_total,
    version_snapshot, auth.uid()
  ) returning id into version_id;

  insert into public.timetable_publication_events (
    timetable_version_id, event_type, from_status, to_status, note, performed_by
  ) values (version_id, 'created', null, 'draft', nullif(trim(version_change_summary), ''), auth.uid());

  return version_id;
end;
$$;

create or replace function public.transition_timetable_version(
  target_version_id uuid,
  target_status text,
  transition_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_version public.timetable_versions%rowtype;
  allowed boolean := false;
  event_name text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'You are not authorized to change timetable publication status.';
  end if;

  select * into selected_version from public.timetable_versions where id = target_version_id for update;
  if selected_version.id is null then
    raise exception using errcode = 'P0002', message = 'The timetable version was not found.';
  end if;

  allowed :=
    (selected_version.status = 'draft' and target_status = 'under_review') or
    (selected_version.status = 'under_review' and target_status in ('approved','draft')) or
    (selected_version.status = 'approved' and target_status in ('published','under_review')) or
    (selected_version.status = 'published' and target_status = 'archived');

  if not allowed then
    raise exception using errcode = '22023', message = format('Unsupported timetable transition from %s to %s.', selected_version.status, target_status);
  end if;

  if target_status = 'published' then
    update public.timetable_versions
    set status = 'archived', archived_by = auth.uid(), archived_at = now(), updated_at = now()
    where academic_period_id = selected_version.academic_period_id
      and status = 'published'
      and id <> selected_version.id;
  end if;

  event_name := case target_status
    when 'under_review' then case when selected_version.status = 'approved' then 'reopened' else 'submitted' end
    when 'approved' then 'approved'
    when 'published' then 'published'
    when 'archived' then 'archived'
    when 'draft' then 'reopened'
  end;

  update public.timetable_versions
  set status = target_status,
      submitted_by = case when target_status = 'under_review' and selected_version.status = 'draft' then auth.uid() else submitted_by end,
      submitted_at = case when target_status = 'under_review' and selected_version.status = 'draft' then now() else submitted_at end,
      approved_by = case when target_status = 'approved' then auth.uid() else approved_by end,
      approved_at = case when target_status = 'approved' then now() else approved_at end,
      published_by = case when target_status = 'published' then auth.uid() else published_by end,
      published_at = case when target_status = 'published' then now() else published_at end,
      archived_by = case when target_status = 'archived' then auth.uid() else archived_by end,
      archived_at = case when target_status = 'archived' then now() else archived_at end,
      updated_at = now()
  where id = target_version_id;

  insert into public.timetable_publication_events (
    timetable_version_id, event_type, from_status, to_status, note, performed_by
  ) values (
    target_version_id, event_name, selected_version.status, target_status,
    nullif(trim(transition_note), ''), auth.uid()
  );
end;
$$;

revoke all on function public.create_timetable_version(uuid, text, text) from public;
revoke all on function public.transition_timetable_version(uuid, text, text) from public;
grant execute on function public.create_timetable_version(uuid, text, text) to authenticated;
grant execute on function public.transition_timetable_version(uuid, text, text) to authenticated;

comment on table public.timetable_versions is 'Immutable timetable snapshots managed through draft, review, approval, publication and archival states.';
comment on table public.timetable_publication_events is 'Audit history for every timetable publication workflow transition.';

commit;
