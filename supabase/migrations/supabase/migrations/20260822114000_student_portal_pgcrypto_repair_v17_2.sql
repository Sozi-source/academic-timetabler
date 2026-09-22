begin;

-- ============================================================================
-- Student Portal Access V17.2 — pgcrypto repair
--
-- Supabase installs pgcrypto functions in the extensions schema in this
-- project environment. V17 incorrectly qualified crypt/gen_salt as public.*.
-- This migration repairs both PIN issue/reset and PIN authentication.
-- ============================================================================

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
    extensions.crypt(
      plain_pin,
      extensions.gen_salt(
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
    extensions.crypt(
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

commit;
