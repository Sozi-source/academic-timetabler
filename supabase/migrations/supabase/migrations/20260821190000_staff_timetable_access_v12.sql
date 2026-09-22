begin;

-- ============================================================================
-- Staff Timetable Access V12
--
-- Staff timetable visibility is publication-driven. Trainers can read only
-- their own locked scheduled sessions. Draft and confirmed timetable work
-- remains inside the HOD scheduling workflow.
-- ============================================================================

alter table public.scheduled_sessions
  enable row level security;

drop policy if exists scheduled_sessions_staff_hod_all
on public.scheduled_sessions;

create policy scheduled_sessions_staff_hod_all
on public.scheduled_sessions
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists scheduled_sessions_staff_published_read
on public.scheduled_sessions;

create policy scheduled_sessions_staff_published_read
on public.scheduled_sessions
for select
to authenticated
using (
  public.current_trainer_id() is not null
  and trainer_id =
    public.current_trainer_id()
  and status::text =
    'locked'
);

grant select
on public.scheduled_sessions
to authenticated;

alter table public.working_days
  enable row level security;

drop policy if exists working_days_staff_hod_all
on public.working_days;

create policy working_days_staff_hod_all
on public.working_days
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists working_days_staff_published_read
on public.working_days;

create policy working_days_staff_published_read
on public.working_days
for select
to authenticated
using (
  exists (
    select 1
    from public.scheduled_sessions
      as session
    where session.trainer_id =
        public.current_trainer_id()
      and session.status::text =
        'locked'
      and session.working_day_id =
        working_days.id
  )
);

grant select
on public.working_days
to authenticated;

alter table public.time_slots
  enable row level security;

drop policy if exists time_slots_staff_hod_all
on public.time_slots;

create policy time_slots_staff_hod_all
on public.time_slots
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists time_slots_staff_published_read
on public.time_slots;

create policy time_slots_staff_published_read
on public.time_slots
for select
to authenticated
using (
  exists (
    select 1
    from public.scheduled_sessions
      as session
    where session.trainer_id =
        public.current_trainer_id()
      and session.status::text =
        'locked'
      and (
        session.start_time_slot_id =
          time_slots.id
        or session.end_time_slot_id =
          time_slots.id
      )
  )
);

grant select
on public.time_slots
to authenticated;

alter table public.rooms
  enable row level security;

drop policy if exists rooms_staff_hod_all
on public.rooms;

create policy rooms_staff_hod_all
on public.rooms
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists rooms_staff_published_read
on public.rooms;

create policy rooms_staff_published_read
on public.rooms
for select
to authenticated
using (
  exists (
    select 1
    from public.scheduled_sessions
      as session
    where session.trainer_id =
        public.current_trainer_id()
      and session.status::text =
        'locked'
      and session.room_id =
        rooms.id
  )
);

grant select
on public.rooms
to authenticated;

commit;
