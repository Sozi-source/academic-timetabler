begin;

-- ============================================================================
-- Student Portal Access Administration V17
--
-- Adds:
-- - HOD/system-admin access register
-- - immutable access events
-- - enable/disable controls
-- - session revocation on PIN reset/disable
-- - failed-login throttling for 6-digit PIN authentication
-- ============================================================================

alter table public.student_portal_credentials
  add column if not exists failed_login_attempts integer
    not null
    default 0;

alter table public.student_portal_credentials
  add column if not exists locked_until timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'student_portal_credentials_failed_attempts_check'
  ) then
    alter table public.student_portal_credentials
      add constraint student_portal_credentials_failed_attempts_check
      check (
        failed_login_attempts >= 0
        and failed_login_attempts <= 100
      );
  end if;
end;
$$;

create table if not exists public.student_portal_access_events (
  id uuid primary key
    default gen_random_uuid(),

  student_id uuid not null
    references public.students(id)
    on delete cascade,

  department_id uuid not null
    references public.departments(id)
    on delete restrict,

  event_type text not null
    check (
      event_type in (
        'issued',
        'reset',
        'activated',
        'deactivated'
      )
    ),

  actor_id uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now()
);

create index if not exists
  student_portal_access_events_student_idx
on public.student_portal_access_events (
  student_id,
  created_at desc
);

create index if not exists
  student_portal_access_events_department_idx
on public.student_portal_access_events (
  department_id,
  created_at desc
);

alter table public.student_portal_access_events
  enable row level security;

drop policy if exists
  student_portal_access_events_department_read
on public.student_portal_access_events;

create policy student_portal_access_events_department_read
on public.student_portal_access_events
for select
to authenticated
using (
  public.current_user_can_manage_department(
    department_id
  )
);

grant select
on public.student_portal_access_events
to authenticated;

-- ----------------------------------------------------------------------------
-- PIN issue/reset.
-- Existing sessions are revoked whenever a PIN changes.
-- Reset also clears failed-login lock state.
-- ----------------------------------------------------------------------------

create or replace function public.set_student_portal_pin(
  target_student_id uuid,
  plain_pin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_department uuid;
  had_credential boolean;
begin
  if plain_pin !~
    '^[0-9]{6}$'
  then
    raise exception
      using errcode = '22023',
      message =
        'Student portal PIN must contain exactly 6 digits';
  end if;

  select
    student.department_id
  into selected_department
  from public.students
    as student
  where student.id =
    target_student_id;

  if selected_department is null then
    raise exception
      using errcode = 'P0002',
      message =
        'Student not found';
  end if;

  if not public.current_user_can_manage_department(
    selected_department
  ) then
    raise exception
      using errcode = '42501',
      message =
        'Not permitted to manage this student';
  end if;

  select exists (
    select 1
    from public.student_portal_credentials
      as credential
    where credential.student_id =
      target_student_id
  )
  into had_credential;

  insert into public.student_portal_credentials (
    student_id,
    pin_hash,
    is_active,
    issued_at,
    issued_by,
    failed_login_attempts,
    locked_until,
    updated_at
  )
  values (
    target_student_id,
    public.crypt(
      plain_pin,
      public.gen_salt(
        'bf',
        10
      )
    ),
    true,
    now(),
    auth.uid(),
    0,
    null,
    now()
  )
  on conflict (
    student_id
  )
  do update set
    pin_hash =
      excluded.pin_hash,
    is_active =
      true,
    issued_at =
      now(),
    issued_by =
      auth.uid(),
    failed_login_attempts =
      0,
    locked_until =
      null,
    updated_at =
      now();

  update public.student_portal_sessions
  set
    revoked_at =
      coalesce(
        revoked_at,
        now()
      )
  where student_id =
      target_student_id
    and revoked_at is null;

  insert into public.student_portal_access_events (
    student_id,
    department_id,
    event_type,
    actor_id
  )
  values (
    target_student_id,
    selected_department,
    case
      when had_credential
      then 'reset'
      else 'issued'
    end,
    auth.uid()
  );
end;
$$;

revoke all
on function public.set_student_portal_pin(
  uuid,
  text
)
from public;

grant execute
on function public.set_student_portal_pin(
  uuid,
  text
)
to authenticated;

-- ----------------------------------------------------------------------------
-- Enable/disable existing access.
-- Disabling immediately revokes every active student portal session.
-- ----------------------------------------------------------------------------

create or replace function public.set_student_portal_access_state(
  target_student_id uuid,
  target_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_department uuid;
  existing_state boolean;
begin
  select
    student.department_id,
    credential.is_active
  into
    selected_department,
    existing_state
  from public.students
    as student
  join public.student_portal_credentials
    as credential
    on credential.student_id =
      student.id
  where student.id =
    target_student_id
  for update of credential;

  if selected_department is null then
    raise exception
      using errcode = 'P0002',
      message =
        'Student portal access has not been issued';
  end if;

  if not public.current_user_can_manage_department(
    selected_department
  ) then
    raise exception
      using errcode = '42501',
      message =
        'Not permitted to manage this student';
  end if;

  if existing_state is distinct from
    target_is_active
  then
    update public.student_portal_credentials
    set
      is_active =
        target_is_active,
      failed_login_attempts =
        case
          when target_is_active
          then 0
          else failed_login_attempts
        end,
      locked_until =
        case
          when target_is_active
          then null
          else locked_until
        end,
      updated_at =
        now()
    where student_id =
      target_student_id;

    if not target_is_active then
      update public.student_portal_sessions
      set
        revoked_at =
          coalesce(
            revoked_at,
            now()
          )
      where student_id =
          target_student_id
        and revoked_at is null;
    end if;

    insert into public.student_portal_access_events (
      student_id,
      department_id,
      event_type,
      actor_id
    )
    values (
      target_student_id,
      selected_department,
      case
        when target_is_active
        then 'activated'
        else 'deactivated'
      end,
      auth.uid()
    );
  end if;
end;
$$;

revoke all
on function public.set_student_portal_access_state(
  uuid,
  boolean
)
from public;

grant execute
on function public.set_student_portal_access_state(
  uuid,
  boolean
)
to authenticated;

-- ----------------------------------------------------------------------------
-- HOD/system-admin register for the currently active department.
-- Credential hashes are never exposed.
-- ----------------------------------------------------------------------------

create or replace function public.get_student_portal_access_register()
returns table (
  student_id uuid,
  admission_number text,
  full_name text,
  programme_code text,
  cohort_name text,
  lifecycle_status text,
  has_credential boolean,
  is_active boolean,
  issued_at timestamptz,
  last_login_at timestamptz,
  failed_login_attempts integer,
  locked_until timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_department uuid;
begin
  selected_department =
    public.current_user_primary_department_id();

  if selected_department is null
     or not public.current_user_can_manage_department(
       selected_department
     )
  then
    raise exception
      using errcode = '42501',
      message =
        'No manageable active department is available';
  end if;

  return query
  select
    student.id,
    student.admission_number,
    student.full_name,
    programme.code,
    cohort.name,
    student.lifecycle_status::text,
    credential.student_id is not null,
    coalesce(
      credential.is_active,
      false
    ),
    credential.issued_at,
    credential.last_login_at,
    coalesce(
      credential.failed_login_attempts,
      0
    ),
    credential.locked_until
  from public.students
    as student
  left join public.programmes
    as programme
    on programme.id =
      student.programme_id
  left join public.cohorts
    as cohort
    on cohort.id =
      student.current_cohort_id
  left join public.student_portal_credentials
    as credential
    on credential.student_id =
      student.id
  where student.department_id =
      selected_department
    and student.lifecycle_status::text in (
      'admitted',
      'active'
    )
  order by
    student.full_name,
    student.admission_number;
end;
$$;

revoke all
on function public.get_student_portal_access_register()
from public;

grant execute
on function public.get_student_portal_access_register()
to authenticated;

-- ----------------------------------------------------------------------------
-- Harden anonymous student PIN authentication.
--
-- Five consecutive failures lock access for 15 minutes. A correct login or
-- HOD PIN reset clears the failed-attempt state. The function still returns
-- only a UUID or null, preserving non-enumerating login behaviour.
-- ----------------------------------------------------------------------------

create or replace function public.authenticate_student_portal(
  supplied_admission_number text,
  supplied_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  credential_row record;
  next_attempt_count integer;
begin
  select
    student.id
      as student_id,
    student.lifecycle_status::text
      as lifecycle_status,
    credential.pin_hash,
    credential.is_active,
    credential.failed_login_attempts,
    credential.locked_until
  into credential_row
  from public.students
    as student
  join public.student_portal_credentials
    as credential
    on credential.student_id =
      student.id
  where upper(
      trim(
        student.admission_number
      )
    ) =
    upper(
      trim(
        supplied_admission_number
      )
    )
  order by
    student.created_at asc
  limit 1
  for update of credential;

  if not found then
    return null;
  end if;

  if not credential_row.is_active
     or credential_row.lifecycle_status
       not in (
         'admitted',
         'active'
       )
  then
    return null;
  end if;

  if credential_row.locked_until is not null
     and credential_row.locked_until >
       now()
  then
    return null;
  end if;

  if credential_row.pin_hash =
    public.crypt(
      supplied_pin,
      credential_row.pin_hash
    )
  then
    update public.student_portal_credentials
    set
      last_login_at =
        now(),
      failed_login_attempts =
        0,
      locked_until =
        null,
      updated_at =
        now()
    where student_id =
      credential_row.student_id;

    return credential_row.student_id;
  end if;

  next_attempt_count =
    coalesce(
      credential_row.failed_login_attempts,
      0
    ) + 1;

  update public.student_portal_credentials
  set
    failed_login_attempts =
      case
        when next_attempt_count >= 5
        then 0
        else next_attempt_count
      end,
    locked_until =
      case
        when next_attempt_count >= 5
        then now() +
          interval '15 minutes'
        else null
      end,
    updated_at =
      now()
  where student_id =
    credential_row.student_id;

  return null;
end;
$$;

revoke all
on function public.authenticate_student_portal(
  text,
  text
)
from public;

grant execute
on function public.authenticate_student_portal(
  text,
  text
)
to anon,
   authenticated;

comment on table public.student_portal_access_events is
  'Immutable HOD/system-admin student portal access issue, reset and state-change history.';

comment on function public.get_student_portal_access_register() is
  'Returns eligible students and non-secret portal access status for the caller active managed department.';

comment on function public.set_student_portal_access_state(uuid, boolean) is
  'Enables or disables one existing student portal credential and revokes active sessions when disabled.';

commit;
