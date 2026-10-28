-- ============================================================================
-- Migration: Allow HOD / Admin to reopen "cancelled" (Did Not Take Place) sessions
--
-- Why:
--   Previously, reopen_class_attendance_session only permitted reopening sessions
--   with status = 'completed'. If a trainer mistakenly marked a session as
--   "Did Not Take Place" (status = 'cancelled'), the HOD had no way to undo it —
--   the RPC would raise an error and the UI would not even show the Reopen button
--   for cancelled sessions.
--
-- Fix:
--   Extend the guard to allow both 'completed' AND 'cancelled' statuses to be
--   reopened. When a cancelled session is reopened:
--   - status is set back to 'open'
--   - notes (the cancellation reason) is cleared
--   - a 'session_reopened' audit event is logged with from_status = 'cancelled'
--   - reopened_at / reopened_by are stamped
-- ============================================================================

create or replace function public.reopen_class_attendance_session(
  target_class_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_status      text;
  session_department_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select
    session.status,
    programme.department_id
  into
    current_status,
    session_department_id
  from public.class_sessions as session
  join public.cohorts as cohort
    on cohort.id = session.cohort_id
  join public.programmes as programme
    on programme.id = cohort.programme_id
  where session.id = target_class_session_id
  for update of session;

  if not found then
    raise exception
      'Class attendance session was not found.'
      using errcode = 'P0002';
  end if;

  if not public.current_user_can_manage_department(
    session_department_id
  ) then
    raise exception
      'This attendance session is outside your active department.'
      using errcode = '42501';
  end if;

  -- Allow reopening both completed attendance AND cancelled (Did Not Take Place) sessions.
  if current_status not in ('completed', 'cancelled') then
    raise exception
      'Only completed or cancelled attendance sessions can be reopened.'
      using errcode = '23514';
  end if;

  update public.class_sessions
  set
    status        = 'open',
    -- Clear the cancellation reason so the trainer can record proper attendance
    notes         = null,
    reopened_at   = now(),
    reopened_by   = auth.uid(),
    completed_at  = null,
    completed_by  = null,
    updated_at    = now()
  where id = target_class_session_id;

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
    current_status,   -- preserves whether it was 'completed' or 'cancelled'
    'open',
    auth.uid()
  );
end;
$$;

-- Grants remain unchanged — authenticated users only, no public access.
revoke all
on function public.reopen_class_attendance_session(uuid)
from public;

grant execute
on function public.reopen_class_attendance_session(uuid)
to authenticated;

comment on function public.reopen_class_attendance_session(uuid) is
  'Allows HOD / system_admin to reopen a class attendance session that was either completed or mistakenly marked as cancelled (Did Not Take Place), returning it to open status so accurate attendance can be recorded.';
