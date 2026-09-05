-- Self-Service Student Account Activation RPC
-- Allows students to activate their portal account by providing their Full Admission Number, Phone Number, and Preferred PIN/Password.

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
  select id, phone_number
  into target_student_id, existing_phone
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

  -- 4. Upsert into student_portal_credentials
  insert into public.student_portal_credentials (
    student_id,
    pin_hash,
    is_active,
    failed_login_attempts,
    locked_until,
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
    now()
  )
  on conflict (student_id) do update
  set pin_hash = excluded.pin_hash,
      is_active = true,
      failed_login_attempts = 0,
      locked_until = null,
      updated_at = now();

  return target_student_id;
end;
$$;

grant execute on function public.activate_student_portal_account(text, text, text) to anon, authenticated;
