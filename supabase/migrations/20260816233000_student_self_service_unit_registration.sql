-- ============================================================
-- Student Lifecycle Phase 5.1: student self-service unit registration
-- ============================================================
-- Students confirm the units they intend to take. Department staff then
-- manually verify the submission. Only verified rows are authoritative for
-- attendance and assessment populations.

create type public.student_unit_submission_status as enum (
  'draft',
  'submitted',
  'verified',
  'returned'
);

create table public.student_portal_credentials (
  student_id uuid primary key references public.students(id) on delete cascade,
  pin_hash text not null,
  is_active boolean not null default true,
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null default auth.uid(),
  last_login_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.student_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index student_portal_sessions_student_idx
  on public.student_portal_sessions (student_id, expires_at desc);

create table public.student_unit_registration_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_period_id uuid not null references public.academic_periods(id) on delete restrict,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  status public.student_unit_submission_status not null default 'draft',
  has_exception boolean not null default false,
  exception_reason text,
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verification_note text,
  returned_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (student_id, academic_period_id),
  constraint student_unit_submission_exception_reason_check
    check (exception_reason is null or char_length(trim(exception_reason)) between 3 and 1000),
  constraint student_unit_submission_verification_note_check
    check (verification_note is null or char_length(trim(verification_note)) <= 1000)
);

create index student_unit_submission_period_idx
  on public.student_unit_registration_submissions (academic_period_id, status);
create index student_unit_submission_student_idx
  on public.student_unit_registration_submissions (student_id, academic_period_id);

alter table public.student_unit_registrations
  add column submission_id uuid references public.student_unit_registration_submissions(id) on delete cascade;

create index student_unit_registrations_submission_idx
  on public.student_unit_registrations (submission_id);

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
begin
  if plain_pin !~ '^[0-9]{6}$' then
    raise exception using errcode = '22023', message = 'Student portal PIN must contain exactly 6 digits';
  end if;

  select department_id into selected_department
  from public.students
  where id = target_student_id;

  if selected_department is null then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;

  if not public.current_user_can_manage_department(selected_department) then
    raise exception using errcode = '42501', message = 'Not permitted to manage this student';
  end if;

  insert into public.student_portal_credentials(student_id, pin_hash, is_active, issued_at, issued_by, updated_at)
  values (
    target_student_id,
    public.crypt(plain_pin, public.gen_salt('bf', 10)),
    true,
    now(),
    auth.uid(),
    now()
  )
  on conflict (student_id) do update set
    pin_hash = excluded.pin_hash,
    is_active = true,
    issued_at = now(),
    issued_by = auth.uid(),
    updated_at = now();
end;
$$;

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
  matched_student_id uuid;
begin
  select s.id into matched_student_id
  from public.students s
  join public.student_portal_credentials c on c.student_id = s.id
  where upper(trim(s.admission_number)) = upper(trim(supplied_admission_number))
    and c.is_active
    and c.pin_hash = public.crypt(supplied_pin, c.pin_hash)
    and s.lifecycle_status in ('admitted', 'active')
  order by s.created_at asc
  limit 1;

  if matched_student_id is not null then
    update public.student_portal_credentials
    set last_login_at = now()
    where student_id = matched_student_id;
  end if;

  return matched_student_id;
end;
$$;

create or replace function public.verify_student_unit_registration(
  target_submission_id uuid,
  decision_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_submission public.student_unit_registration_submissions%rowtype;
  selected_department uuid;
begin
  select * into selected_submission
  from public.student_unit_registration_submissions
  where id = target_submission_id
  for update;

  if selected_submission.id is null then
    raise exception using errcode = 'P0002', message = 'Registration submission not found';
  end if;

  select department_id into selected_department
  from public.students
  where id = selected_submission.student_id;

  if not public.current_user_can_manage_department(selected_department) then
    raise exception using errcode = '42501', message = 'Not permitted to verify this registration';
  end if;

  if selected_submission.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'Only submitted registrations can be verified';
  end if;

  update public.student_unit_registration_submissions
  set status = 'verified',
      verified_at = now(),
      verified_by = auth.uid(),
      verification_note = nullif(trim(decision_note), ''),
      updated_at = now()
  where id = target_submission_id;
end;
$$;

create or replace function public.return_student_unit_registration(
  target_submission_id uuid,
  decision_note text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_submission public.student_unit_registration_submissions%rowtype;
  selected_department uuid;
begin
  if char_length(trim(coalesce(decision_note, ''))) < 3 then
    raise exception using errcode = '22023', message = 'A brief return reason is required';
  end if;

  select * into selected_submission
  from public.student_unit_registration_submissions
  where id = target_submission_id
  for update;

  if selected_submission.id is null then
    raise exception using errcode = 'P0002', message = 'Registration submission not found';
  end if;

  select department_id into selected_department
  from public.students
  where id = selected_submission.student_id;

  if not public.current_user_can_manage_department(selected_department) then
    raise exception using errcode = '42501', message = 'Not permitted to return this registration';
  end if;

  if selected_submission.status not in ('submitted', 'verified') then
    raise exception using errcode = 'P0001', message = 'This registration cannot be returned from its current status';
  end if;

  update public.student_unit_registration_submissions
  set status = 'returned',
      returned_at = now(),
      verification_note = trim(decision_note),
      verified_at = null,
      verified_by = null,
      updated_at = now()
  where id = target_submission_id;
end;
$$;

grant execute on function public.set_student_portal_pin(uuid, text) to authenticated;
grant execute on function public.authenticate_student_portal(text, text) to anon, authenticated;
grant execute on function public.verify_student_unit_registration(uuid, text) to authenticated;
grant execute on function public.return_student_unit_registration(uuid, text) to authenticated;

alter table public.student_portal_credentials enable row level security;
alter table public.student_portal_sessions enable row level security;
alter table public.student_unit_registration_submissions enable row level security;

revoke all on table public.student_portal_credentials from anon, authenticated;
revoke all on table public.student_portal_sessions from anon, authenticated;
revoke all on table public.student_unit_registration_submissions from anon;
revoke all on table public.student_unit_registration_submissions from authenticated;
grant select, insert, update on table public.student_unit_registration_submissions to authenticated;

create policy student_unit_submissions_read
on public.student_unit_registration_submissions for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_id
      and public.current_user_can_access_department(s.department_id)
  )
);

create policy student_unit_submissions_insert
on public.student_unit_registration_submissions for insert to authenticated
with check (
  exists (
    select 1 from public.students s
    where s.id = student_id
      and public.current_user_can_manage_department(s.department_id)
  )
);

create policy student_unit_submissions_update
on public.student_unit_registration_submissions for update to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_id
      and public.current_user_can_manage_department(s.department_id)
  )
)
with check (
  exists (
    select 1 from public.students s
    where s.id = student_id
      and public.current_user_can_manage_department(s.department_id)
  )
);

create or replace view public.verified_student_unit_registrations
with (security_invoker = true)
as
select r.*
from public.student_unit_registrations r
join public.student_unit_registration_submissions s
  on s.id = r.submission_id
where s.status = 'verified'
  and r.registration_status = 'registered';

grant select on public.verified_student_unit_registrations to authenticated;

comment on table public.student_unit_registration_submissions is
  'Student-submitted unit selection. Department verification makes the linked unit rows authoritative for downstream attendance and assessment reporting.';
comment on view public.verified_student_unit_registrations is
  'Authoritative verified per-student unit roster for attendance, CAT and examination population reports.';

create or replace function public.submit_student_unit_registration_for_student(
  target_student_id uuid,
  target_academic_period_id uuid,
  selected_unit_ids uuid[],
  supplied_exception_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_student public.students%rowtype;
  submission_id_value uuid;
  existing_status public.student_unit_submission_status;
  expected_units uuid[];
  selected_units uuid[];
  exception_value boolean;
  selected_unit_id uuid;
  selected_offering_id uuid;
begin
  select * into selected_student
  from public.students
  where id = target_student_id;

  if selected_student.id is null
     or selected_student.lifecycle_status not in ('admitted', 'active')
     or selected_student.current_cohort_id is null then
    raise exception using errcode = 'P0001', message = 'Student is not eligible for unit registration';
  end if;

  if not exists (
    select 1 from public.academic_periods
    where id = target_academic_period_id and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'Academic period is not active';
  end if;

  select coalesce(array_agg(distinct uo.unit_id order by uo.unit_id), '{}'::uuid[])
  into expected_units
  from public.unit_offerings uo
  where uo.academic_period_id = target_academic_period_id
    and uo.cohort_id = selected_student.current_cohort_id
    and uo.selection_state = 'included'
    and uo.status <> 'cancelled';

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into selected_units
  from unnest(coalesce(selected_unit_ids, '{}'::uuid[])) x;

  if cardinality(selected_units) = 0 then
    raise exception using errcode = '22023', message = 'Select at least one unit';
  end if;

  if exists (
    select 1
    from unnest(selected_units) chosen(unit_id)
    where not exists (
      select 1
      from public.unit_offerings uo
      join public.units u on u.id = uo.unit_id
      where uo.academic_period_id = target_academic_period_id
        and uo.unit_id = chosen.unit_id
        and uo.selection_state = 'included'
        and uo.status <> 'cancelled'
        and u.programme_id = selected_student.programme_id
    )
  ) then
    raise exception using errcode = '23514', message = 'Selected unit is not available to this programme in the active period';
  end if;

  exception_value := selected_units <> expected_units;
  if exception_value and char_length(trim(coalesce(supplied_exception_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'Explain any change from the expected unit list';
  end if;

  select id, status into submission_id_value, existing_status
  from public.student_unit_registration_submissions
  where student_id = target_student_id
    and academic_period_id = target_academic_period_id
  for update;

  if existing_status in ('submitted', 'verified') then
    raise exception using errcode = 'P0001', message = 'Registration is already submitted';
  end if;

  if submission_id_value is null then
    insert into public.student_unit_registration_submissions(
      student_id, academic_period_id, cohort_id, status,
      has_exception, exception_reason, submitted_at, updated_at
    ) values (
      target_student_id, target_academic_period_id, selected_student.current_cohort_id,
      'submitted', exception_value,
      case when exception_value then trim(supplied_exception_reason) else null end,
      now(), now()
    ) returning id into submission_id_value;
  else
    update public.student_unit_registration_submissions
    set cohort_id = selected_student.current_cohort_id,
        status = 'submitted',
        has_exception = exception_value,
        exception_reason = case when exception_value then trim(supplied_exception_reason) else null end,
        submitted_at = now(),
        returned_at = null,
        verification_note = null,
        updated_at = now()
    where id = submission_id_value;
  end if;

  delete from public.student_unit_registrations
  where student_id = target_student_id
    and academic_period_id = target_academic_period_id;

  foreach selected_unit_id in array selected_units loop
    select uo.id into selected_offering_id
    from public.unit_offerings uo
    join public.units u on u.id = uo.unit_id
    where uo.academic_period_id = target_academic_period_id
      and uo.unit_id = selected_unit_id
      and uo.selection_state = 'included'
      and uo.status <> 'cancelled'
      and u.programme_id = selected_student.programme_id
    order by (uo.cohort_id = selected_student.current_cohort_id) desc, uo.created_at asc
    limit 1;

    insert into public.student_unit_registrations(
      student_id, academic_period_id, cohort_id, unit_id, unit_offering_id,
      submission_id, registration_status, source
    ) values (
      target_student_id, target_academic_period_id, selected_student.current_cohort_id,
      selected_unit_id, selected_offering_id, submission_id_value,
      'registered', 'student_self_service'
    );
  end loop;

  return submission_id_value;
end;
$$;

revoke all on function public.submit_student_unit_registration_for_student(uuid, uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.submit_student_unit_registration_for_student(uuid, uuid, uuid[], text) to service_role;
