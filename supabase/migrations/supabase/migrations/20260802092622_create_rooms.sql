-- ============================================================
-- HND App: Rooms
-- ============================================================

do $$
begin
  create type public.room_type as enum (
    'lecture_room',
    'laboratory',
    'skills_room',
    'computer_lab',
    'kitchen',
    'conference_room',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),

  code text not null,

  name text not null,

  room_type public.room_type
    not null
    default 'lecture_room',

  building text,

  floor_label text,

  capacity integer not null,

  is_accessible boolean
    not null
    default false,

  is_active boolean
    not null
    default true,

  is_timetable_available boolean
    not null
    default true,

  notes text,

  created_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  updated_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint rooms_code_length_check
    check (
      char_length(trim(code)) between 1 and 30
    ),

  constraint rooms_name_length_check
    check (
      char_length(trim(name)) between 2 and 100
    ),

  constraint rooms_building_length_check
    check (
      building is null
      or char_length(trim(building)) <= 100
    ),

  constraint rooms_floor_length_check
    check (
      floor_label is null
      or char_length(trim(floor_label)) <= 50
    ),

  constraint rooms_capacity_check
    check (
      capacity between 1 and 1000
    ),

  constraint rooms_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 1000
    )
);

create unique index rooms_code_unique_idx
  on public.rooms (
    lower(trim(code))
  );

create unique index rooms_name_building_unique_idx
  on public.rooms (
    lower(trim(name)),
    lower(trim(coalesce(building, '')))
  );

create index rooms_type_idx
  on public.rooms (
    room_type
  );

create index rooms_active_idx
  on public.rooms (
    is_active,
    is_timetable_available
  );

create index rooms_capacity_idx
  on public.rooms (
    capacity
  );

-- ------------------------------------------------------------
-- Normalization and audit fields
-- ------------------------------------------------------------

create or replace function
  public.set_room_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.code = upper(trim(new.code));
  new.name = trim(new.name);
  new.building = nullif(trim(new.building), '');
  new.floor_label = nullif(trim(new.floor_label), '');
  new.notes = nullif(trim(new.notes), '');

  new.updated_at = now();
  new.updated_by = auth.uid();

  if new.is_active = false then
    new.is_timetable_available = false;
  end if;

  return new;
end;
$$;

create trigger rooms_set_audit_fields
before insert or update
on public.rooms
for each row
execute function
  public.set_room_audit_fields();

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

alter table public.rooms
enable row level security;

revoke all
on table public.rooms
from anon;

revoke all
on table public.rooms
from authenticated;

grant select, insert, update
on table public.rooms
to authenticated;

create policy
  "Authorized staff can view rooms"
on public.rooms
for select
to authenticated
using (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
);

create policy
  "Authorized staff can create rooms"
on public.rooms
for insert
to authenticated
with check (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
  and created_by = (select auth.uid())
);

create policy
  "Authorized staff can update rooms"
on public.rooms
for update
to authenticated
using (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
)
with check (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
);

-- No DELETE policy is intentionally provided.
-- Rooms should be deactivated to preserve timetable history.

comment on table public.rooms is
  'Teaching and institutional spaces available for timetable scheduling.';

comment on column public.rooms.capacity is
  'Maximum number of learners safely accommodated by the room.';

comment on column public.rooms.is_timetable_available is
  'Determines whether the room may be selected during timetable generation.';

comment on column public.rooms.is_active is
  'Inactive rooms are retained for historical timetable records.';