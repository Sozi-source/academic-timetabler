-- Rooms are optional during timetable generation. A room-pending session is
-- a valid draft session and remains visible as "No room assigned" throughout
-- preview, editing, conflict review, reporting and publication snapshots.

alter table public.scheduled_sessions
  alter column room_id drop not null;

do $migration$
declare
  current_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(
    'public.validate_scheduled_session_relationships()'::regprocedure
  ) into current_definition;

  if position('if selected_room.id is null then' in current_definition) = 0 then
    raise exception
      'validate_scheduled_session_relationships did not contain the expected room validation';
  end if;

  corrected_definition := replace(
    current_definition,
    'if selected_room.id is null then',
    'if new.room_id is not null and selected_room.id is null then'
  );

  execute corrected_definition;

  select pg_get_functiondef(
    'public.validate_pending_scheduled_session()'::regprocedure
  ) into current_definition;

  if position(
    E'if selected_room.id is null\n    or not selected_room.is_active\n    or not selected_room.is_timetable_available then'
    in current_definition
  ) = 0 then
    raise exception
      'validate_pending_scheduled_session did not contain the expected room validation';
  end if;

  corrected_definition := replace(
    current_definition,
    E'if selected_room.id is null\n    or not selected_room.is_active\n    or not selected_room.is_timetable_available then',
    E'if new.room_id is not null and (\n    selected_room.id is null\n    or not selected_room.is_active\n    or not selected_room.is_timetable_available\n  ) then'
  );

  execute corrected_definition;

  select pg_get_functiondef(
    'public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text)'::regprocedure
  ) into current_definition;

  if position(
    'if selected_room.id is null or not selected_room.is_active or not selected_room.is_timetable_available then'
    in current_definition
  ) = 0 then
    raise exception
      'move_scheduled_session_safely did not contain the expected room validation';
  end if;

  corrected_definition := replace(
    current_definition,
    'if selected_room.id is null or not selected_room.is_active or not selected_room.is_timetable_available then',
    'if target_room_id is not null and (selected_room.id is null or not selected_room.is_active or not selected_room.is_timetable_available) then'
  );

  execute corrected_definition;

  select pg_get_functiondef(
    'public.create_timetable_version(uuid,text,text)'::regprocedure
  ) into current_definition;

  if position(
    'join public.rooms room on room.id = session.room_id'
    in current_definition
  ) = 0 then
    raise exception
      'create_timetable_version did not contain the expected room join';
  end if;

  corrected_definition := replace(
    current_definition,
    'join public.rooms room on room.id = session.room_id',
    'left join public.rooms room on room.id = session.room_id'
  );

  corrected_definition := replace(
    corrected_definition,
    E'''roomName'', room.name,',
    E'''roomName'', coalesce(room.name, ''No room assigned''),'
  );

  execute corrected_definition;
end
$migration$;

comment on column public.scheduled_sessions.room_id is
  'Optional room assignment. Null means the timetable session has no room assigned yet.';

comment on function public.validate_scheduled_session_relationships() is
  'Validates assigned-trainer timetable sessions while allowing room assignment to remain pending.';

comment on function public.validate_pending_scheduled_session() is
  'Validates trainer-pending timetable sessions while allowing room assignment to remain pending.';
