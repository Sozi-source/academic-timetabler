begin;

-- ============================================================================
-- Class Attendance V19
--
-- Separate from the printable Attendance Sheet teaching document.
--
-- Population source:
--   teaching allocation
--     -> academic period + cohort + unit
--     -> student_unit_registrations(status='registered')
--
-- Session source:
--   locked/published scheduled_sessions only.
--
-- Attendance states:
--   unmarked -> present | absent
--
-- Completion freezes the session. HOD/system-admin can reopen a completed
-- session for an auditable correction.
-- ============================================================================

create table if not exists public.class_sessions (
  id uuid primary key
    default gen_random_uuid(),

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  teaching_allocation_id uuid not null
    references public.teaching_allocations(id)
    on delete restrict,

  scheduled_session_id uuid not null
    references public.scheduled_sessions(id)
    on delete restrict,

  cohort_id uuid not null
    references public.cohorts(id)
    on delete restrict,

  unit_id uuid not null
    references public.units(id)
    on delete restrict,

  trainer_id uuid not null
    references public.trainers(id)
    on delete restrict,

  session_date date not null,

  starts_at time without time zone not null,

  ends_at time without time zone not null,

  room_id uuid
    references public.rooms(id)
    on delete set null,

  status text not null
    default 'open'
    check (
      status in (
        'open',
        'completed',
        'cancelled'
      )
    ),

  roster_count integer not null
    default 0
    check (
      roster_count >= 0
    ),

  opened_at timestamptz not null
    default now(),

  opened_by uuid
    references auth.users(id)
    on delete set null,

  completed_at timestamptz,

  completed_by uuid
    references auth.users(id)
    on delete set null,

  reopened_at timestamptz,

  reopened_by uuid
    references auth.users(id)
    on delete set null,

  notes text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint class_sessions_time_order_check
    check (
      ends_at > starts_at
    ),

  constraint class_sessions_notes_check
    check (
      notes is null
      or char_length(
        notes
      ) <= 1000
    )
);

create unique index if not exists
  class_sessions_schedule_date_unique_idx
on public.class_sessions (
  scheduled_session_id,
  session_date
)
where status <> 'cancelled';

create index if not exists
  class_sessions_allocation_date_idx
on public.class_sessions (
  teaching_allocation_id,
  session_date desc
);

create index if not exists
  class_sessions_trainer_date_idx
on public.class_sessions (
  trainer_id,
  session_date desc
);

create index if not exists
  class_sessions_period_date_idx
on public.class_sessions (
  academic_period_id,
  session_date desc
);

create table if not exists public.class_attendance_entries (
  id uuid primary key
    default gen_random_uuid(),

  class_session_id uuid not null
    references public.class_sessions(id)
    on delete cascade,

  student_id uuid not null
    references public.students(id)
    on delete restrict,

  cohort_id uuid not null
    references public.cohorts(id)
    on delete restrict,

  attendance_status text not null
    default 'unmarked'
    check (
      attendance_status in (
        'unmarked',
        'present',
        'absent'
      )
    ),

  note text,

  marked_at timestamptz,

  marked_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint class_attendance_entries_note_check
    check (
      note is null
      or char_length(
        note
      ) <= 500
    ),

  constraint class_attendance_entries_session_student_unique
    unique (
      class_session_id,
      student_id
    )
);

create index if not exists
  class_attendance_entries_session_status_idx
on public.class_attendance_entries (
  class_session_id,
  attendance_status
);

create index if not exists
  class_attendance_entries_student_idx
on public.class_attendance_entries (
  student_id,
  created_at desc
);

create table if not exists public.class_attendance_events (
  id uuid primary key
    default gen_random_uuid(),

  class_session_id uuid not null
    references public.class_sessions(id)
    on delete restrict,

  student_id uuid
    references public.students(id)
    on delete restrict,

  event_type text not null
    check (
      event_type in (
        'session_opened',
        'status_changed',
        'session_completed',
        'session_reopened'
      )
    ),

  from_status text,

  to_status text,

  actor_id uuid
    references auth.users(id)
    on delete set null,

  occurred_at timestamptz not null
    default now()
);

create index if not exists
  class_attendance_events_session_idx
on public.class_attendance_events (
  class_session_id,
  occurred_at desc
);

alter table public.class_sessions
  enable row level security;

alter table public.class_attendance_entries
  enable row level security;

alter table public.class_attendance_events
  enable row level security;

revoke all
on table public.class_sessions,
         public.class_attendance_entries,
         public.class_attendance_events
from anon;

revoke insert, update, delete
on table public.class_sessions,
         public.class_attendance_entries,
         public.class_attendance_events
from authenticated;

grant select
on table public.class_sessions,
         public.class_attendance_entries,
         public.class_attendance_events
to authenticated;

drop policy if exists
  class_sessions_authorized_read
on public.class_sessions;

create policy class_sessions_authorized_read
on public.class_sessions
for select
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
  or public.trainer_can_access_allocation(
    teaching_allocation_id
  )
);

drop policy if exists
  class_attendance_entries_authorized_read
on public.class_attendance_entries;

create policy class_attendance_entries_authorized_read
on public.class_attendance_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions
      as session
    where session.id =
        class_attendance_entries.class_session_id
      and (
        public.current_user_has_role(
          array[
            'hod',
            'system_admin'
          ]::public.app_role[]
        )
        or public.trainer_can_access_allocation(
          session.teaching_allocation_id
        )
      )
  )
);

drop policy if exists
  class_attendance_events_authorized_read
on public.class_attendance_events;

create policy class_attendance_events_authorized_read
on public.class_attendance_events
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions
      as session
    where session.id =
        class_attendance_events.class_session_id
      and (
        public.current_user_has_role(
          array[
            'hod',
            'system_admin'
          ]::public.app_role[]
        )
        or public.trainer_can_access_allocation(
          session.teaching_allocation_id
        )
      )
  )
);

-- ----------------------------------------------------------------------------
-- Open one concrete attendance occurrence from a published timetable session.
-- Idempotent for the same scheduled session + date.
-- ----------------------------------------------------------------------------

create or replace function public.open_class_attendance_session(
  target_scheduled_session_id uuid,
  target_session_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  schedule_row record;
  existing_session_id uuid;
  new_session_id uuid;
  roster_total integer;
  expected_isodow integer;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if target_session_date is null then
    raise exception
      'Class date is required.'
      using errcode = '22023';
  end if;

  select
    scheduled.id,
    scheduled.academic_period_id,
    scheduled.teaching_allocation_id,
    scheduled.cohort_id,
    scheduled.unit_id,
    scheduled.trainer_id,
    scheduled.room_id,
    scheduled.status::text
      as schedule_status,
    working_day.day_of_week::text
      as day_of_week,
    start_slot.starts_at,
    end_slot.ends_at,
    period.teaching_starts_on,
    period.teaching_ends_on
  into schedule_row
  from public.scheduled_sessions
    as scheduled
  join public.working_days
    as working_day
    on working_day.id =
      scheduled.working_day_id
  join public.time_slots
    as start_slot
    on start_slot.id =
      scheduled.start_time_slot_id
  join public.time_slots
    as end_slot
    on end_slot.id =
      scheduled.end_time_slot_id
  join public.academic_periods
    as period
    on period.id =
      scheduled.academic_period_id
  where scheduled.id =
    target_scheduled_session_id;

  if not found then
    raise exception
      'Published timetable session was not found.'
      using errcode = 'P0002';
  end if;

  if schedule_row.schedule_status <>
    'locked'
  then
    raise exception
      'Attendance can only be opened from a published timetable session.'
      using errcode = '23514';
  end if;

  if not (
    public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
    or public.trainer_can_access_allocation(
      schedule_row.teaching_allocation_id
    )
  ) then
    raise exception
      'This class is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  if target_session_date <
      schedule_row.teaching_starts_on
     or target_session_date >
      schedule_row.teaching_ends_on
  then
    raise exception
      'Class date must fall within the academic period teaching dates.'
      using errcode = '23514';
  end if;

  expected_isodow =
    case
      schedule_row.day_of_week
      when 'monday'
        then 1
      when 'tuesday'
        then 2
      when 'wednesday'
        then 3
      when 'thursday'
        then 4
      when 'friday'
        then 5
      when 'saturday'
        then 6
      when 'sunday'
        then 7
      else null
    end;

  if expected_isodow is null
     or extract(
       isodow
       from target_session_date
     )::integer <>
       expected_isodow
  then
    raise exception
      'The selected date does not match the published timetable day.'
      using errcode = '23514';
  end if;

  select
    session.id
  into existing_session_id
  from public.class_sessions
    as session
  where session.scheduled_session_id =
      target_scheduled_session_id
    and session.session_date =
      target_session_date
    and session.status <>
      'cancelled'
  limit 1;

  if existing_session_id is not null then
    return existing_session_id;
  end if;

  insert into public.class_sessions (
    academic_period_id,
    teaching_allocation_id,
    scheduled_session_id,
    cohort_id,
    unit_id,
    trainer_id,
    session_date,
    starts_at,
    ends_at,
    room_id,
    status,
    opened_by
  )
  values (
    schedule_row.academic_period_id,
    schedule_row.teaching_allocation_id,
    schedule_row.id,
    schedule_row.cohort_id,
    schedule_row.unit_id,
    schedule_row.trainer_id,
    target_session_date,
    schedule_row.starts_at,
    schedule_row.ends_at,
    schedule_row.room_id,
    'open',
    auth.uid()
  )
  returning id
  into new_session_id;

  insert into public.class_attendance_entries (
    class_session_id,
    student_id,
    cohort_id,
    attendance_status
  )
  select
    new_session_id,
    registration.student_id,
    registration.cohort_id,
    'unmarked'
  from public.student_unit_registrations
    as registration
  where registration.academic_period_id =
      schedule_row.academic_period_id
    and registration.cohort_id =
      schedule_row.cohort_id
    and registration.unit_id =
      schedule_row.unit_id
    and registration.registration_status::text =
      'registered'
  order by
    registration.student_id;

  get diagnostics roster_total =
    row_count;

  if roster_total = 0 then
    raise exception
      'No registered students were found for this unit and cohort.'
      using errcode = 'P0002';
  end if;

  update public.class_sessions
  set
    roster_count =
      roster_total,
    updated_at =
      now()
  where id =
    new_session_id;

  insert into public.class_attendance_events (
    class_session_id,
    event_type,
    to_status,
    actor_id
  )
  values (
    new_session_id,
    'session_opened',
    'open',
    auth.uid()
  );

  return new_session_id;
end;
$$;

revoke all
on function public.open_class_attendance_session(
  uuid,
  date
)
from public;

grant execute
on function public.open_class_attendance_session(
  uuid,
  date
)
to authenticated;

-- ----------------------------------------------------------------------------
-- Save one full/partial attendance draft.
-- ----------------------------------------------------------------------------

create or replace function public.save_class_attendance(
  target_class_session_id uuid,
  target_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row record;
  entry_count integer;
  changed_count integer := 0;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if target_entries is null
     or jsonb_typeof(
       target_entries
     ) <> 'array'
  then
    raise exception
      'Attendance payload must be an array.'
      using errcode = '22023';
  end if;

  select
    session.id,
    session.teaching_allocation_id,
    session.status
  into session_row
  from public.class_sessions
    as session
  where session.id =
    target_class_session_id
  for update;

  if not found then
    raise exception
      'Class attendance session was not found.'
      using errcode = 'P0002';
  end if;

  if not (
    public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
    or public.trainer_can_access_allocation(
      session_row.teaching_allocation_id
    )
  ) then
    raise exception
      'This class is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  if session_row.status <>
    'open'
  then
    raise exception
      'Completed attendance is read only. An HOD must reopen it before correction.'
      using errcode = '23514';
  end if;

  with parsed as (
    select
      item.student_id,
      item.attendance_status,
      nullif(
        trim(
          item.note
        ),
        ''
      ) as note
    from jsonb_to_recordset(
      target_entries
    ) as item(
      student_id uuid,
      attendance_status text,
      note text
    )
  )
  select count(*)::integer
  into entry_count
  from parsed;

  if (
    select count(*)::integer
    from (
      select distinct
        item.student_id
      from jsonb_to_recordset(
        target_entries
      ) as item(
        student_id uuid,
        attendance_status text,
        note text
      )
    ) as distinct_students
  ) <> entry_count
  then
    raise exception
      'Duplicate students were found in the attendance payload.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(
      target_entries
    ) as item(
      student_id uuid,
      attendance_status text,
      note text
    )
    where item.student_id is null
      or item.attendance_status not in (
        'unmarked',
        'present',
        'absent'
      )
      or (
        item.note is not null
        and char_length(
          item.note
        ) > 500
      )
  ) then
    raise exception
      'One or more attendance entries are invalid.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(
      target_entries
    ) as item(
      student_id uuid,
      attendance_status text,
      note text
    )
    where not exists (
      select 1
      from public.class_attendance_entries
        as entry
      where entry.class_session_id =
          target_class_session_id
        and entry.student_id =
          item.student_id
    )
  ) then
    raise exception
      'Attendance may only be recorded for students in the locked class roster.'
      using errcode = '23514';
  end if;

  with parsed as (
    select
      item.student_id,
      item.attendance_status,
      nullif(
        trim(
          item.note
        ),
        ''
      ) as note
    from jsonb_to_recordset(
      target_entries
    ) as item(
      student_id uuid,
      attendance_status text,
      note text
    )
  ),
  changed as (
    select
      entry.id,
      entry.student_id,
      entry.attendance_status
        as old_status,
      parsed.attendance_status
        as new_status,
      parsed.note
        as new_note
    from public.class_attendance_entries
      as entry
    join parsed
      on parsed.student_id =
         entry.student_id
    where entry.class_session_id =
        target_class_session_id
      and (
        entry.attendance_status <>
          parsed.attendance_status
        or entry.note is distinct from
          parsed.note
      )
  ),
  logged as (
    insert into public.class_attendance_events (
      class_session_id,
      student_id,
      event_type,
      from_status,
      to_status,
      actor_id
    )
    select
      target_class_session_id,
      changed.student_id,
      'status_changed',
      changed.old_status,
      changed.new_status,
      auth.uid()
    from changed
    returning 1
  )
  select count(*)::integer
  into changed_count
  from logged;

  update public.class_attendance_entries
    as entry
  set
    attendance_status =
      item.attendance_status,
    note =
      nullif(
        trim(
          item.note
        ),
        ''
      ),
    marked_at =
      case
        when item.attendance_status =
          'unmarked'
        then null
        else now()
      end,
    marked_by =
      case
        when item.attendance_status =
          'unmarked'
        then null
        else auth.uid()
      end,
    updated_at =
      now()
  from jsonb_to_recordset(
    target_entries
  ) as item(
    student_id uuid,
    attendance_status text,
    note text
  )
  where entry.class_session_id =
      target_class_session_id
    and entry.student_id =
      item.student_id;

  update public.class_sessions
  set
    updated_at =
      now()
  where id =
    target_class_session_id;

  return jsonb_build_object(
    'sessionId',
    target_class_session_id,
    'savedCount',
    entry_count,
    'changedCount',
    changed_count,
    'status',
    'open'
  );
end;
$$;

revoke all
on function public.save_class_attendance(
  uuid,
  jsonb
)
from public;

grant execute
on function public.save_class_attendance(
  uuid,
  jsonb
)
to authenticated;

-- ----------------------------------------------------------------------------
-- Complete attendance only when every student has a final status.
-- ----------------------------------------------------------------------------

create or replace function public.complete_class_attendance_session(
  target_class_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row record;
  unmarked_count integer;
  present_count integer;
  absent_count integer;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select
    session.id,
    session.teaching_allocation_id,
    session.status
  into session_row
  from public.class_sessions
    as session
  where session.id =
    target_class_session_id
  for update;

  if not found then
    raise exception
      'Class attendance session was not found.'
      using errcode = 'P0002';
  end if;

  if not (
    public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
    or public.trainer_can_access_allocation(
      session_row.teaching_allocation_id
    )
  ) then
    raise exception
      'This class is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  if session_row.status <>
    'open'
  then
    raise exception
      'Only an open attendance session can be completed.'
      using errcode = '23514';
  end if;

  select
    count(*) filter (
      where attendance_status =
        'unmarked'
    )::integer,
    count(*) filter (
      where attendance_status =
        'present'
    )::integer,
    count(*) filter (
      where attendance_status =
        'absent'
    )::integer
  into
    unmarked_count,
    present_count,
    absent_count
  from public.class_attendance_entries
  where class_session_id =
    target_class_session_id;

  if unmarked_count > 0 then
    raise exception
      'Attendance is incomplete. Mark every student before completing the session.'
      using errcode = '23514';
  end if;

  update public.class_sessions
  set
    status =
      'completed',
    completed_at =
      now(),
    completed_by =
      auth.uid(),
    updated_at =
      now()
  where id =
    target_class_session_id;

  insert into public.class_attendance_events (
    class_session_id,
    event_type,
    from_status,
    to_status,
    actor_id
  )
  values (
    target_class_session_id,
    'session_completed',
    'open',
    'completed',
    auth.uid()
  );

  return jsonb_build_object(
    'sessionId',
    target_class_session_id,
    'status',
    'completed',
    'present',
    present_count,
    'absent',
    absent_count
  );
end;
$$;

revoke all
on function public.complete_class_attendance_session(uuid)
from public;

grant execute
on function public.complete_class_attendance_session(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- Controlled correction: HOD/system-admin only.
-- ----------------------------------------------------------------------------

create or replace function public.reopen_class_attendance_session(
  target_class_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_status text;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an HOD or system administrator can reopen completed attendance.'
      using errcode = '42501';
  end if;

  select
    status
  into current_status
  from public.class_sessions
  where id =
    target_class_session_id
  for update;

  if not found then
    raise exception
      'Class attendance session was not found.'
      using errcode = 'P0002';
  end if;

  if current_status <>
    'completed'
  then
    raise exception
      'Only completed attendance can be reopened.'
      using errcode = '23514';
  end if;

  update public.class_sessions
  set
    status =
      'open',
    reopened_at =
      now(),
    reopened_by =
      auth.uid(),
    completed_at =
      null,
    completed_by =
      null,
    updated_at =
      now()
  where id =
    target_class_session_id;

  insert into public.class_attendance_events (
    class_session_id,
    event_type,
    from_status,
    to_status,
    actor_id
  )
  values (
    target_class_session_id,
    'session_reopened',
    'completed',
    'open',
    auth.uid()
  );
end;
$$;

revoke all
on function public.reopen_class_attendance_session(uuid)
from public;

grant execute
on function public.reopen_class_attendance_session(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- Staff published schedule + attendance status.
-- ----------------------------------------------------------------------------

create or replace function public.get_staff_class_attendance_schedule()
returns table (
  scheduled_session_id uuid,
  teaching_allocation_id uuid,
  academic_period_id uuid,
  academic_period_name text,
  cohort_id uuid,
  cohort_name text,
  unit_id uuid,
  unit_name text,
  day_of_week text,
  day_sequence integer,
  starts_at time without time zone,
  ends_at time without time zone,
  session_number integer,
  teaching_starts_on date,
  teaching_ends_on date,
  latest_class_session_id uuid,
  latest_session_date date,
  latest_status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    scheduled.id,
    scheduled.teaching_allocation_id,
    scheduled.academic_period_id,
    period.name,
    scheduled.cohort_id,
    cohort.name,
    scheduled.unit_id,
    unit.name,
    working_day.day_of_week::text,
    working_day.sequence_number::integer,
    start_slot.starts_at,
    end_slot.ends_at,
    scheduled.session_number::integer,
    period.teaching_starts_on,
    period.teaching_ends_on,
    latest.id,
    latest.session_date,
    latest.status
  from public.scheduled_sessions
    as scheduled
  join public.academic_periods
    as period
    on period.id =
      scheduled.academic_period_id
  join public.cohorts
    as cohort
    on cohort.id =
      scheduled.cohort_id
  join public.units
    as unit
    on unit.id =
      scheduled.unit_id
  join public.working_days
    as working_day
    on working_day.id =
      scheduled.working_day_id
  join public.time_slots
    as start_slot
    on start_slot.id =
      scheduled.start_time_slot_id
  join public.time_slots
    as end_slot
    on end_slot.id =
      scheduled.end_time_slot_id
  left join lateral (
    select
      session.id,
      session.session_date,
      session.status
    from public.class_sessions
      as session
    where session.scheduled_session_id =
      scheduled.id
      and session.status <>
        'cancelled'
    order by
      session.session_date desc,
      session.created_at desc
    limit 1
  ) as latest
    on true
  where scheduled.status::text =
      'locked'
    and public.trainer_can_access_allocation(
      scheduled.teaching_allocation_id
    )
  order by
    working_day.sequence_number,
    start_slot.starts_at,
    unit.name,
    cohort.name;
$$;

revoke all
on function public.get_staff_class_attendance_schedule()
from public;

grant execute
on function public.get_staff_class_attendance_schedule()
to authenticated;

create or replace function public.get_staff_class_attendance_history(
  target_limit integer default 30
)
returns table (
  class_session_id uuid,
  teaching_allocation_id uuid,
  session_date date,
  status text,
  unit_name text,
  cohort_name text,
  starts_at time without time zone,
  ends_at time without time zone,
  roster_count integer,
  present_count integer,
  absent_count integer,
  unmarked_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    session.id,
    session.teaching_allocation_id,
    session.session_date,
    session.status,
    unit.name,
    cohort.name,
    session.starts_at,
    session.ends_at,
    session.roster_count,
    count(entry.id) filter (
      where entry.attendance_status =
        'present'
    )::integer,
    count(entry.id) filter (
      where entry.attendance_status =
        'absent'
    )::integer,
    count(entry.id) filter (
      where entry.attendance_status =
        'unmarked'
    )::integer
  from public.class_sessions
    as session
  join public.units
    as unit
    on unit.id =
      session.unit_id
  join public.cohorts
    as cohort
    on cohort.id =
      session.cohort_id
  left join public.class_attendance_entries
    as entry
    on entry.class_session_id =
      session.id
  where session.status <>
      'cancelled'
    and public.trainer_can_access_allocation(
      session.teaching_allocation_id
    )
  group by
    session.id,
    unit.name,
    cohort.name
  order by
    session.session_date desc,
    session.starts_at desc
  limit greatest(
    1,
    least(
      coalesce(
        target_limit,
        30
      ),
      100
    )
  );
$$;

revoke all
on function public.get_staff_class_attendance_history(integer)
from public;

grant execute
on function public.get_staff_class_attendance_history(integer)
to authenticated;

create or replace function public.get_class_attendance_workspace(
  target_class_session_id uuid
)
returns table (
  class_session_id uuid,
  teaching_allocation_id uuid,
  scheduled_session_id uuid,
  session_date date,
  session_status text,
  academic_period_name text,
  unit_name text,
  cohort_name text,
  starts_at time without time zone,
  ends_at time without time zone,
  roster_count integer,
  student_id uuid,
  admission_number text,
  full_name text,
  attendance_status text,
  note text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  allocation_id uuid;
begin
  select
    session.teaching_allocation_id
  into allocation_id
  from public.class_sessions
    as session
  where session.id =
    target_class_session_id;

  if allocation_id is null then
    raise exception
      'Class attendance session was not found.'
      using errcode = 'P0002';
  end if;

  if not (
    public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
    or public.trainer_can_access_allocation(
      allocation_id
    )
  ) then
    raise exception
      'This class is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  return query
  select
    session.id,
    session.teaching_allocation_id,
    session.scheduled_session_id,
    session.session_date,
    session.status,
    period.name,
    unit.name,
    cohort.name,
    session.starts_at,
    session.ends_at,
    session.roster_count,
    student.id,
    student.admission_number,
    student.full_name,
    entry.attendance_status,
    entry.note
  from public.class_sessions
    as session
  join public.academic_periods
    as period
    on period.id =
      session.academic_period_id
  join public.units
    as unit
    on unit.id =
      session.unit_id
  join public.cohorts
    as cohort
    on cohort.id =
      session.cohort_id
  join public.class_attendance_entries
    as entry
    on entry.class_session_id =
      session.id
  join public.students
    as student
    on student.id =
      entry.student_id
  where session.id =
    target_class_session_id
  order by
    student.full_name,
    student.admission_number;
end;
$$;

revoke all
on function public.get_class_attendance_workspace(uuid)
from public;

grant execute
on function public.get_class_attendance_workspace(uuid)
to authenticated;

comment on table public.class_sessions is
  'Concrete class occurrences created only from published timetable sessions. Separate from printable teaching-document Attendance Sheets.';

comment on table public.class_attendance_entries is
  'Locked per-class student roster with Present or Absent operational attendance status.';

comment on table public.class_attendance_events is
  'Immutable class-attendance status and lifecycle audit history.';

commit;
