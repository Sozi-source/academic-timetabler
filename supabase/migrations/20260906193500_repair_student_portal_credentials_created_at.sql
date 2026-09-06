-- Migration: Repair student_portal_credentials created_at column and self-service activation RPC
-- Resolves error: column "created_at" of relation "student_portal_credentials" does not exist

-- 1. Ensure created_at exists on student_portal_credentials for backward and forward compatibility
alter table public.student_portal_credentials
  add column if not exists created_at timestamptz not null default now();

-- Backfill created_at from issued_at if available
update public.student_portal_credentials
set created_at = coalesce(issued_at, now())
where created_at is null;

-- 2. Update activate_student_portal_account RPC to safely handle issued_at, created_at, and department logging
create or replace function public.activate_student_portal_account(
  supplied_admission_number text,
  supplied_phone_number text,
  new_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_student_id uuid;
  target_department_id uuid;
  clean_admission text;
  clean_phone text;
  clean_pin text;
  existing_phone text;
  new_hash text;
begin
  clean_admission := upper(trim(supplied_admission_number));
  clean_phone := regexp_replace(trim(supplied_phone_number), '\s+', '', 'g');
  clean_pin := trim(new_pin);

  if clean_admission = '' or clean_phone = '' or length(clean_pin) < 4 then
    raise exception 'Invalid input parameters for student account activation.';
  end if;

  -- 1. Find active student by admission number
  select id, phone_number, department_id
  into target_student_id, existing_phone, target_department_id
  from public.students
  where upper(trim(admission_number)) = clean_admission
    and lifecycle_status in ('admitted', 'active')
  order by created_at asc
  limit 1;

  if target_student_id is null then
    raise exception 'No active student record found matching admission number: %', supplied_admission_number;
  end if;

  -- 2. Verify or update phone number
  if existing_phone is not null and trim(existing_phone) <> '' then
    -- Strip non-digits for resilient comparison
    if regexp_replace(existing_phone, '\D', '', 'g') <> regexp_replace(clean_phone, '\D', '', 'g') then
      raise exception 'Provided phone number does not match the registered student contact record.';
    end if;
  else
    -- Register contact phone number if previously unrecorded
    update public.students
    set phone_number = clean_phone,
        updated_at = now()
    where id = target_student_id;
  end if;

  -- 3. Hash the student's chosen preferred PIN/password
  new_hash := extensions.crypt(clean_pin, extensions.gen_salt('bf'));

  -- 4. Upsert into student_portal_credentials (using both issued_at and created_at)
  insert into public.student_portal_credentials (
    student_id,
    pin_hash,
    is_active,
    failed_login_attempts,
    locked_until,
    issued_at,
    created_at,
    updated_at
  )
  values (
    target_student_id,
    new_hash,
    true,
    0,
    null,
    now(),
    now(),
    now()
  )
  on conflict (student_id) do update
  set pin_hash = excluded.pin_hash,
      is_active = true,
      failed_login_attempts = 0,
      locked_until = null,
      updated_at = now();

  -- 5. Record audit access event if student_portal_access_events table exists
  begin
    insert into public.student_portal_access_events (
      student_id,
      department_id,
      event_type,
      actor_id
    )
    values (
      target_student_id,
      target_department_id,
      'activated',
      null
    );
  exception when others then
    -- Non-blocking: Do not fail activation if event logging table is missing or restricted
    null;
  end;

  return target_student_id;
end;
$$;

grant execute on function public.activate_student_portal_account(text, text, text) to anon, authenticated;
