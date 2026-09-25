-- A registered unit roster is immediately authoritative and verified.
-- Backfill historical and active-period registrations before installing the trigger.

insert into public.student_unit_registration_submissions as existing_submission (
  student_id,
  academic_period_id,
  cohort_id,
  status,
  submitted_at,
  verified_at,
  updated_at
)
select distinct on (registration.student_id, registration.academic_period_id)
  registration.student_id,
  registration.academic_period_id,
  registration.cohort_id,
  'verified'::public.student_unit_submission_status,
  now(),
  now(),
  now()
from public.student_unit_registrations registration
join public.students student on student.id = registration.student_id
where registration.registration_status = 'registered'
  and student.academic_phase <> 'attachment'
order by registration.student_id, registration.academic_period_id, registration.registered_at desc
on conflict (student_id, academic_period_id) do update
set status = 'verified',
    submitted_at = coalesce(existing_submission.submitted_at, excluded.submitted_at),
    verified_at = coalesce(existing_submission.verified_at, excluded.verified_at),
    returned_at = null,
    updated_at = now();

create or replace function public.auto_verify_registered_unit_roster()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_id_value uuid;
begin
  if new.registration_status <> 'registered' then
    return new;
  end if;

  insert into public.student_unit_registration_submissions as existing_submission (
    student_id,
    academic_period_id,
    cohort_id,
    status,
    submitted_at,
    verified_at,
    updated_at
  ) values (
    new.student_id,
    new.academic_period_id,
    new.cohort_id,
    'verified',
    now(),
    now(),
    now()
  )
  on conflict (student_id, academic_period_id) do update
  set cohort_id = excluded.cohort_id,
      status = 'verified',
      submitted_at = coalesce(existing_submission.submitted_at, excluded.submitted_at),
      verified_at = coalesce(existing_submission.verified_at, excluded.verified_at),
      returned_at = null,
      updated_at = now()
  returning id into submission_id_value;

  if new.submission_id is distinct from submission_id_value then
    update public.student_unit_registrations
    set submission_id = submission_id_value
    where id = new.id;
  end if;

  return new;
end;
$$;

create trigger auto_verify_registered_unit_roster_write
after insert or update of student_id, academic_period_id, cohort_id, registration_status
on public.student_unit_registrations
for each row
execute function public.auto_verify_registered_unit_roster();

revoke all on function public.auto_verify_registered_unit_roster() from public, anon, authenticated;

comment on table public.student_unit_registration_submissions is
  'Unit registration submission status is automatically verified when the student has a registered unit roster.';
