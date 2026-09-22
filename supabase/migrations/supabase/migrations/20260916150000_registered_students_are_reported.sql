-- Unit registration is the authoritative class-roster decision. A student who
-- remains registered is included in trainer documents and starts attendance as
-- present; a student who does not attend should be unregistered from the unit.

begin;

-- Reconcile every existing registered student with the period reporting record.
insert into public.student_period_reporting (
  department_id,
  student_id,
  academic_period_id,
  reporting_status,
  reported_on,
  confirmed_at,
  notes
)
select distinct
  student.department_id,
  registration.student_id,
  registration.academic_period_id,
  'reported',
  current_date,
  now(),
  'Automatically confirmed from unit registration.'
from public.student_unit_registrations registration
join public.students student
  on student.id = registration.student_id
where registration.registration_status = 'registered'
on conflict (student_id, academic_period_id) do update
set reporting_status = 'reported',
    reported_on = coalesce(student_period_reporting.reported_on, current_date),
    confirmed_at = coalesce(student_period_reporting.confirmed_at, now()),
    updated_at = now(),
    notes = coalesce(
      student_period_reporting.notes,
      'Automatically confirmed from unit registration.'
    );

-- Keep the reporting record in sync whether a registration is newly inserted
-- or restored from another registration status by a batch operation.
create or replace function public.ensure_student_period_reporting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_department_id uuid;
begin
  if new.registration_status <> 'registered' then
    return new;
  end if;

  select department_id into selected_department_id
  from public.students
  where id = new.student_id;

  if selected_department_id is not null then
    insert into public.student_period_reporting (
      department_id,
      student_id,
      academic_period_id,
      reporting_status,
      reported_on,
      confirmed_at,
      notes
    ) values (
      selected_department_id,
      new.student_id,
      new.academic_period_id,
      'reported',
      current_date,
      now(),
      'Automatically confirmed from unit registration.'
    )
    on conflict (student_id, academic_period_id) do update
    set reporting_status = 'reported',
        reported_on = coalesce(student_period_reporting.reported_on, current_date),
        confirmed_at = coalesce(student_period_reporting.confirmed_at, now()),
        updated_at = now(),
        notes = coalesce(
          student_period_reporting.notes,
          'Automatically confirmed from unit registration.'
        );
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_student_period_reporting_on_registration
  on public.student_unit_registrations;

create trigger ensure_student_period_reporting_on_registration
after insert or update of registration_status
on public.student_unit_registrations
for each row
when (new.registration_status = 'registered')
execute function public.ensure_student_period_reporting();

-- Preserve historical registers while collapsing the retired state into Present.
update public.class_attendance_entries
set attendance_status = 'present',
    updated_at = now()
where attendance_status = 'not_reported';

update public.trainer_daily_report_lessons
set present_count = present_count + not_reported_count,
    not_reported_count = 0
where not_reported_count > 0;

alter table public.class_attendance_entries
  drop constraint if exists class_attendance_entries_attendance_status_check;

alter table public.class_attendance_entries
  add constraint class_attendance_entries_attendance_status_check
  check (attendance_status in ('unmarked', 'present', 'absent'));

-- Older database functions can still emit the retired state until their next
-- deployment. Normalize it at the table boundary so every saved roster remains
-- a Present/Absent register.
create or replace function public.normalize_class_attendance_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.attendance_status = 'not_reported' then
    new.attendance_status := 'present';
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_class_attendance_status_before_write
  on public.class_attendance_entries;

create trigger normalize_class_attendance_status_before_write
before insert or update of attendance_status
on public.class_attendance_entries
for each row
execute function public.normalize_class_attendance_status();

commit;
