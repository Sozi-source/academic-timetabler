-- Harden trainer attendance integrity after the session-date reuse fix.
--
-- Guarantees:
--   1. one active attendance session per scheduled session/date;
--   2. one active semantic session per allocation/date/start time;
--   3. completed/cancelled historical session dates cannot be rewritten.
--
-- The open RPC also serializes concurrent opens in the preceding migration.

-- Reassert the database-level uniqueness backstops. These are idempotent.
create unique index if not exists class_sessions_schedule_date_unique_idx
on public.class_sessions (
  scheduled_session_id,
  session_date
)
where scheduled_session_id is not null
  and status <> 'cancelled';

create unique index if not exists class_sessions_semantic_unique_idx
on public.class_sessions (
  teaching_allocation_id,
  session_date,
  starts_at
)
where status <> 'cancelled';

-- Historical attendance belongs to the date on which it was recorded.
-- Timetable changes may relink a historical session to a new scheduled_session_id
-- when the scheduler needs to detach a deleted timetable row, but the actual
-- attendance date must never be rewritten.
create or replace function public.prevent_historical_attendance_date_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status in ('completed', 'cancelled')
     and new.session_date is distinct from old.session_date then
    raise exception
      'Historical attendance session date cannot be changed.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists class_sessions_prevent_historical_date_change
on public.class_sessions;

create trigger class_sessions_prevent_historical_date_change
before update of session_date
on public.class_sessions
for each row
execute function public.prevent_historical_attendance_date_change();

comment on function public.prevent_historical_attendance_date_change() is
  'Prevents completed/cancelled attendance records from being moved to another date while allowing timetable reconciliation to relink scheduled_session_id.';
