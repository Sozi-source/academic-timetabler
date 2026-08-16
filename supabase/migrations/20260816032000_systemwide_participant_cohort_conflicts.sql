-- Keep cohort membership authoritative for every shared allocation and saved
-- session. Conflict detection must include every participating cohort, not
-- only the primary cohort stored on the row.

create or replace function public.resolve_participant_cohort_ids(
  p_primary_cohort_id uuid,
  p_teaching_offering_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(member.cohort_id order by member.cohort_id),
    array[p_primary_cohort_id]
  )
  from (
    select p_primary_cohort_id as cohort_id
    where p_primary_cohort_id is not null

    union

    select participant.cohort_id
    from public.teaching_offering_participants participant
    where participant.teaching_offering_id = p_teaching_offering_id
  ) member;
$$;

create or replace function public.resolve_participant_cohort_size(
  p_participant_cohort_ids uuid[]
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(greatest(cohort.actual_size, 0)), 0)::integer
  from public.cohorts cohort
  where cohort.id = any(coalesce(p_participant_cohort_ids, '{}'::uuid[]));
$$;

revoke all
on function public.resolve_participant_cohort_ids(uuid, uuid)
from public;

revoke all
on function public.resolve_participant_cohort_size(uuid[])
from public;

grant execute
on function public.resolve_participant_cohort_ids(uuid, uuid)
to authenticated;

grant execute
on function public.resolve_participant_cohort_size(uuid[])
to authenticated;

create or replace function public.set_teaching_allocation_participant_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.participant_cohort_ids :=
    public.resolve_participant_cohort_ids(
      new.cohort_id,
      new.teaching_offering_id
    );

  new.combined_cohort_size :=
    public.resolve_participant_cohort_size(
      new.participant_cohort_ids
    );

  return new;
end;
$$;

drop trigger if exists teaching_allocations_participant_context
on public.teaching_allocations;

create trigger teaching_allocations_participant_context
before insert or update of
  cohort_id,
  teaching_offering_id
on public.teaching_allocations
for each row
execute function public.set_teaching_allocation_participant_context();

create or replace function public.sync_allocation_participants_to_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.scheduled_sessions session
  set
    participant_cohort_ids = new.participant_cohort_ids,
    combined_cohort_size = new.combined_cohort_size,
    updated_at = now()
  where session.teaching_allocation_id = new.id
    and (
      session.participant_cohort_ids
        is distinct from new.participant_cohort_ids
      or session.combined_cohort_size
        is distinct from new.combined_cohort_size
    );

  return new;
end;
$$;

drop trigger if exists teaching_allocations_sync_participants_to_sessions
on public.teaching_allocations;

create trigger teaching_allocations_sync_participants_to_sessions
after insert or update of
  participant_cohort_ids,
  combined_cohort_size
on public.teaching_allocations
for each row
execute function public.sync_allocation_participants_to_sessions();

create or replace function public.refresh_shared_class_participant_context(
  p_teaching_offering_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_teaching_offering_id is null then
    return;
  end if;

  update public.teaching_allocations allocation
  set
    participant_cohort_ids =
      public.resolve_participant_cohort_ids(
        allocation.cohort_id,
        allocation.teaching_offering_id
      ),
    combined_cohort_size =
      public.resolve_participant_cohort_size(
        public.resolve_participant_cohort_ids(
          allocation.cohort_id,
          allocation.teaching_offering_id
        )
      ),
    updated_at = now()
  where allocation.teaching_offering_id = p_teaching_offering_id;
end;
$$;

revoke all
on function public.refresh_shared_class_participant_context(uuid)
from public;

create or replace function public.refresh_shared_class_participants_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_shared_class_participant_context(
      old.teaching_offering_id
    );
    return old;
  elsif tg_op = 'INSERT' then
    perform public.refresh_shared_class_participant_context(
      new.teaching_offering_id
    );
    return new;
  end if;

  perform public.refresh_shared_class_participant_context(
    old.teaching_offering_id
  );

  if new.teaching_offering_id
      is distinct from old.teaching_offering_id then
    perform public.refresh_shared_class_participant_context(
      new.teaching_offering_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists teaching_offering_participants_refresh_context
on public.teaching_offering_participants;

create trigger teaching_offering_participants_refresh_context
after insert or update of
  teaching_offering_id,
  cohort_id
or delete
on public.teaching_offering_participants
for each row
execute function public.refresh_shared_class_participants_trigger();

create or replace function public.set_shared_session_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocation public.teaching_allocations%rowtype;
begin
  select source_allocation.*
  into allocation
  from public.teaching_allocations source_allocation
  where source_allocation.id = new.teaching_allocation_id;

  if allocation.id is null then
    raise exception 'The teaching allocation was not found';
  end if;

  new.participant_cohort_ids :=
    public.resolve_participant_cohort_ids(
      allocation.cohort_id,
      allocation.teaching_offering_id
    );

  new.combined_cohort_size :=
    public.resolve_participant_cohort_size(
      new.participant_cohort_ids
    );

  return new;
end;
$$;

drop trigger if exists scheduled_sessions_shared_context
on public.scheduled_sessions;

create trigger scheduled_sessions_shared_context
before insert or update of
  teaching_allocation_id,
  cohort_id
on public.scheduled_sessions
for each row
execute function public.set_shared_session_context();

-- Enforce participant-cohort clashes at the database boundary as well. This
-- protects generation, manual moves, imports and any future session writer.
create or replace function public.validate_scheduled_session_conflicts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_start_slot public.time_slots%rowtype;
  selected_end_slot public.time_slots%rowtype;
  selected_trainer public.trainers%rowtype;
  approved_full_day boolean := false;
  selected_participant_cohort_ids uuid[] := '{}'::uuid[];
  session_duration_minutes integer;
  existing_daily_minutes integer;
  existing_weekly_minutes integer;
  trainer_conflict_exists boolean;
  cohort_conflict_exists boolean;
  room_conflict_exists boolean;
begin
  if new.status in ('cancelled', 'archived') then
    new.conflict_state := 'clear';
    return new;
  end if;

  select *
  into selected_start_slot
  from public.time_slots
  where id = new.start_time_slot_id;

  select *
  into selected_end_slot
  from public.time_slots
  where id = new.end_time_slot_id;

  select *
  into selected_trainer
  from public.trainers
  where id = new.trainer_id;

  select
    coalesce(allocation.is_full_day_session, false),
    public.resolve_participant_cohort_ids(
      allocation.cohort_id,
      allocation.teaching_offering_id
    )
  into
    approved_full_day,
    selected_participant_cohort_ids
  from public.teaching_allocations allocation
  where allocation.id = new.teaching_allocation_id;

  if cardinality(selected_participant_cohort_ids) = 0 then
    selected_participant_cohort_ids := array[new.cohort_id];
  end if;

  session_duration_minutes :=
    extract(epoch from (
      selected_end_slot.ends_at - selected_start_slot.starts_at
    ))::integer / 60;

  select exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start
      on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id = existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id = new.academic_period_id
      and existing.working_day_id = new.working_day_id
      and existing.trainer_id = new.trainer_id
      and existing.status not in ('cancelled', 'archived')
      and existing_start.starts_at < selected_end_slot.ends_at
      and selected_start_slot.starts_at < existing_end.ends_at
  ) into trainer_conflict_exists;

  if trainer_conflict_exists then
    raise exception using
      errcode = '23P01',
      message = 'Trainer clash: the trainer already has another session during the selected time';
  end if;

  select exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start
      on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id = existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id = new.academic_period_id
      and existing.working_day_id = new.working_day_id
      and array_append(
        coalesce(existing.participant_cohort_ids, '{}'::uuid[]),
        existing.cohort_id
      ) && selected_participant_cohort_ids
      and existing.status not in ('cancelled', 'archived')
      and existing_start.starts_at < selected_end_slot.ends_at
      and selected_start_slot.starts_at < existing_end.ends_at
  ) into cohort_conflict_exists;

  if cohort_conflict_exists then
    raise exception using
      errcode = '23P01',
      message = 'Cohort clash: a participating cohort already has another session during the selected time';
  end if;

  select exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start
      on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id = existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id = new.academic_period_id
      and existing.working_day_id = new.working_day_id
      and existing.room_id = new.room_id
      and existing.status not in ('cancelled', 'archived')
      and existing_start.starts_at < selected_end_slot.ends_at
      and selected_start_slot.starts_at < existing_end.ends_at
  ) into room_conflict_exists;

  if room_conflict_exists then
    raise exception using
      errcode = '23P01',
      message = 'Room clash: the room already has another session during the selected time';
  end if;

  select coalesce(
    sum(
      extract(epoch from (
        existing_end.ends_at - existing_start.starts_at
      ))::integer / 60
    ),
    0
  )
  into existing_daily_minutes
  from public.scheduled_sessions existing
  join public.time_slots existing_start
    on existing_start.id = existing.start_time_slot_id
  join public.time_slots existing_end
    on existing_end.id = existing.end_time_slot_id
  where existing.id <> new.id
    and existing.academic_period_id = new.academic_period_id
    and existing.working_day_id = new.working_day_id
    and existing.trainer_id = new.trainer_id
    and existing.status not in ('cancelled', 'archived');

  if not approved_full_day
    and existing_daily_minutes + session_duration_minutes
      > selected_trainer.maximum_daily_hours * 60 then
    raise exception using
      errcode = 'P0001',
      message = 'The scheduled session would exceed the trainer maximum daily workload';
  end if;

  select coalesce(
    sum(
      extract(epoch from (
        existing_end.ends_at - existing_start.starts_at
      ))::integer / 60
    ),
    0
  )
  into existing_weekly_minutes
  from public.scheduled_sessions existing
  join public.time_slots existing_start
    on existing_start.id = existing.start_time_slot_id
  join public.time_slots existing_end
    on existing_end.id = existing.end_time_slot_id
  where existing.id <> new.id
    and existing.academic_period_id = new.academic_period_id
    and existing.trainer_id = new.trainer_id
    and existing.status not in ('cancelled', 'archived');

  if existing_weekly_minutes + session_duration_minutes
    > selected_trainer.maximum_weekly_hours * 60 then
    raise exception using
      errcode = 'P0001',
      message = 'The scheduled session would exceed the trainer maximum weekly workload';
  end if;

  new.conflict_state := 'clear';
  return new;
end;
$$;

-- Repair all current allocations. The allocation-to-session trigger repairs
-- their saved draft, confirmed and locked sessions in the same transaction.
update public.teaching_allocations allocation
set
  participant_cohort_ids =
    public.resolve_participant_cohort_ids(
      allocation.cohort_id,
      allocation.teaching_offering_id
    ),
  combined_cohort_size =
    public.resolve_participant_cohort_size(
      public.resolve_participant_cohort_ids(
        allocation.cohort_id,
        allocation.teaching_offering_id
      )
    ),
  updated_at = now()
where
  allocation.participant_cohort_ids
    is distinct from public.resolve_participant_cohort_ids(
      allocation.cohort_id,
      allocation.teaching_offering_id
    )
  or allocation.combined_cohort_size
    is distinct from public.resolve_participant_cohort_size(
      public.resolve_participant_cohort_ids(
        allocation.cohort_id,
        allocation.teaching_offering_id
      )
    );

-- Defensive repair for any orphaned legacy session whose allocation context
-- was already correct and therefore did not fire the update trigger above.
update public.scheduled_sessions session
set
  participant_cohort_ids = allocation.participant_cohort_ids,
  combined_cohort_size = allocation.combined_cohort_size,
  updated_at = now()
from public.teaching_allocations allocation
where allocation.id = session.teaching_allocation_id
  and (
    session.participant_cohort_ids
      is distinct from allocation.participant_cohort_ids
    or session.combined_cohort_size
      is distinct from allocation.combined_cohort_size
  );

create index if not exists teaching_allocations_shared_offering_lookup_idx
on public.teaching_allocations (teaching_offering_id)
where teaching_offering_id is not null;

comment on function public.resolve_participant_cohort_ids(uuid, uuid) is
  'Returns the authoritative, sorted participant cohort set for an allocation, always including its primary cohort.';

comment on function public.refresh_shared_class_participant_context(uuid) is
  'Synchronizes participant cohorts and combined class size from a shared teaching offering to allocations and scheduled sessions.';
