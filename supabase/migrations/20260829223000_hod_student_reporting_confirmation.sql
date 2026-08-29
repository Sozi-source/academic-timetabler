-- HOD-managed reporting confirmation for department-assigned unit registration.
-- Students receive their assigned units without self-registering. Reporting is
-- confirmed per academic period before the student is treated as active.

create table if not exists public.student_period_reporting (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_period_id uuid not null references public.academic_periods(id) on delete cascade,
  reporting_status text not null default 'pending'
    check (reporting_status in ('pending', 'reported', 'deferred', 'dropped_out')),
  reported_on date,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_period_id),
  check (
    (reporting_status = 'reported' and reported_on is not null and confirmed_at is not null)
    or reporting_status <> 'reported'
  )
);

create index if not exists student_period_reporting_period_status_idx
  on public.student_period_reporting (academic_period_id, department_id, reporting_status);

alter table public.student_period_reporting enable row level security;
revoke all on table public.student_period_reporting from public, anon, authenticated;
grant select on table public.student_period_reporting to authenticated;

drop policy if exists student_period_reporting_department_select
  on public.student_period_reporting;
create policy student_period_reporting_department_select
  on public.student_period_reporting
  for select
  to authenticated
  using (public.current_user_can_manage_department(department_id));

create or replace function public.ensure_student_period_reporting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_department_id uuid;
begin
  select department_id into selected_department_id
  from public.students
  where id = new.student_id;

  if selected_department_id is not null then
    insert into public.student_period_reporting (
      department_id,
      student_id,
      academic_period_id,
      reporting_status
    ) values (
      selected_department_id,
      new.student_id,
      new.academic_period_id,
      'pending'
    )
    on conflict (student_id, academic_period_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_student_period_reporting_on_registration
  on public.student_unit_registrations;
create trigger ensure_student_period_reporting_on_registration
after insert on public.student_unit_registrations
for each row execute function public.ensure_student_period_reporting();

create or replace function public.sync_student_reporting_lifecycle_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_reporting_status text;
begin
  next_reporting_status := case
    when new.lifecycle_status = 'deferred' then 'deferred'
    when new.lifecycle_status in ('dropped_out', 'withdrawn', 'discontinued') then 'dropped_out'
    else null
  end;

  if next_reporting_status is not null then
    update public.student_period_reporting reporting
    set reporting_status = next_reporting_status,
        reported_on = null,
        confirmed_at = null,
        confirmed_by = null,
        updated_at = now()
    from public.academic_periods period
    where reporting.student_id = new.id
      and reporting.academic_period_id = period.id
      and period.status = 'active';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_student_reporting_lifecycle_status
  on public.students;
create trigger sync_student_reporting_lifecycle_status
after update of lifecycle_status on public.students
for each row
when (old.lifecycle_status is distinct from new.lifecycle_status)
execute function public.sync_student_reporting_lifecycle_status();

insert into public.student_period_reporting (
  department_id,
  student_id,
  academic_period_id,
  reporting_status
)
select distinct
  student.department_id,
  registration.student_id,
  registration.academic_period_id,
  'pending'
from public.student_unit_registrations registration
join public.students student on student.id = registration.student_id
where registration.registration_status = 'registered'
on conflict (student_id, academic_period_id) do nothing;

create or replace view public.assessment_registration_candidates
with (security_invoker = true)
as
select
  registration.student_id,
  registration.academic_period_id,
  registration.unit_id,
  registration.cohort_id,
  registration.registration_status::text as registration_status
from public.student_unit_registrations registration
join public.student_period_reporting reporting
  on reporting.student_id = registration.student_id
 and reporting.academic_period_id = registration.academic_period_id
where reporting.reporting_status = 'reported';

grant select on public.assessment_registration_candidates to authenticated;

comment on view public.assessment_registration_candidates is
  'Assessment candidates are registered students whose physical reporting has been confirmed for the academic period.';

create or replace function public.confirm_students_reported(
  target_academic_period_id uuid,
  target_student_ids uuid[],
  reporting_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmed_count integer := 0;
  restored_registration_count integer := 0;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Only an HOD or system administrator can confirm reporting';
  end if;

  if target_academic_period_id is null
     or coalesce(cardinality(target_student_ids), 0) = 0 then
    raise exception using errcode = '22023', message = 'Academic period and students are required';
  end if;

  insert into public.student_period_reporting (
    department_id,
    student_id,
    academic_period_id,
    reporting_status,
    reported_on,
    confirmed_at,
    confirmed_by
  )
  select
    student.department_id,
    student.id,
    target_academic_period_id,
    'reported',
    coalesce(reporting_date, current_date),
    now(),
    auth.uid()
  from public.students student
  where student.id = any(target_student_ids)
    and public.current_user_can_manage_department(student.department_id)
    and student.lifecycle_status in ('admitted', 'active')
  on conflict (student_id, academic_period_id) do update
    set reporting_status = 'reported',
        reported_on = excluded.reported_on,
        confirmed_at = excluded.confirmed_at,
        confirmed_by = excluded.confirmed_by,
        updated_at = now();

  get diagnostics confirmed_count = row_count;

  update public.students student
  set lifecycle_status = 'active'
  where student.id = any(target_student_ids)
    and student.lifecycle_status = 'admitted'
    and public.current_user_can_manage_department(student.department_id);

  update public.student_unit_registrations registration
  set registration_status = 'registered',
      notes = nullif(trim(concat_ws(E'\n', registration.notes, 'Restored after reporting confirmation.')), ''),
      updated_by = auth.uid(),
      updated_at = now()
  from public.students student
  where registration.student_id = student.id
    and registration.academic_period_id = target_academic_period_id
    and registration.registration_status = 'dropped'
    and student.id = any(target_student_ids)
    and public.current_user_can_manage_department(student.department_id);

  get diagnostics restored_registration_count = row_count;

  return jsonb_build_object(
    'confirmed_students', confirmed_count,
    'restored_registrations', restored_registration_count
  );
end;
$$;

create or replace function public.drop_unconfirmed_student_units(
  target_academic_period_id uuid,
  target_student_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  dropped_registration_count integer := 0;
  affected_student_count integer := 0;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Only an HOD or system administrator can remove unconfirmed registrations';
  end if;

  if target_academic_period_id is null
     or coalesce(cardinality(target_student_ids), 0) = 0 then
    raise exception using errcode = '22023', message = 'Academic period and students are required';
  end if;

  with eligible_students as (
    select student.id
    from public.students student
    left join public.student_period_reporting reporting
      on reporting.student_id = student.id
     and reporting.academic_period_id = target_academic_period_id
    where student.id = any(target_student_ids)
      and public.current_user_can_manage_department(student.department_id)
      and coalesce(reporting.reporting_status, 'pending') <> 'reported'
  ), updated as (
    update public.student_unit_registrations registration
    set registration_status = 'dropped',
        notes = nullif(trim(concat_ws(E'\n', registration.notes, 'Dropped because reporting was not confirmed.')), ''),
        updated_by = auth.uid(),
        updated_at = now()
    where registration.student_id in (select id from eligible_students)
      and registration.academic_period_id = target_academic_period_id
      and registration.registration_status = 'registered'
    returning registration.student_id
  )
  select count(*), count(distinct student_id)
  into dropped_registration_count, affected_student_count
  from updated;

  return jsonb_build_object(
    'affected_students', affected_student_count,
    'dropped_registrations', dropped_registration_count
  );
end;
$$;

revoke all on function public.confirm_students_reported(uuid, uuid[], date)
  from public, anon;
grant execute on function public.confirm_students_reported(uuid, uuid[], date)
  to authenticated;

revoke all on function public.drop_unconfirmed_student_units(uuid, uuid[])
  from public, anon;
grant execute on function public.drop_unconfirmed_student_units(uuid, uuid[])
  to authenticated;

comment on table public.student_period_reporting is
  'Period-specific student reporting confirmation. Unit allocation remains HOD-managed; students do not repeat unit selection.';
