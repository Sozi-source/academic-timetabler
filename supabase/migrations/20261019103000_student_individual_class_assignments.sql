-- Allow an individual registered student to attend another cohort's existing class.
-- The assignment does not alter the student's cohort, registration or timetable.
create table public.student_class_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_period_id uuid not null references public.academic_periods(id) on delete restrict,
  source_registration_id uuid not null references public.student_unit_registrations(id) on delete cascade,
  teaching_allocation_id uuid not null references public.teaching_allocations(id) on delete cascade,
  reason text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_class_assignments_reason_check check (char_length(trim(reason)) between 3 and 500)
);

create unique index student_class_assignments_active_unique
  on public.student_class_assignments(student_id, source_registration_id, teaching_allocation_id)
  where is_active;
create index student_class_assignments_allocation_idx
  on public.student_class_assignments(teaching_allocation_id, academic_period_id)
  where is_active;

create or replace function public.validate_student_class_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_student public.students%rowtype;
  selected_registration public.student_unit_registrations%rowtype;
  selected_allocation public.teaching_allocations%rowtype;
  selected_department uuid;
  target_department uuid;
begin
  select * into selected_student from public.students where id = new.student_id;
  select * into selected_registration from public.student_unit_registrations where id = new.source_registration_id;
  select * into selected_allocation from public.teaching_allocations where id = new.teaching_allocation_id;
  if selected_student.id is null or selected_registration.id is null or selected_allocation.id is null then
    raise exception using errcode = '23503', message = 'Student, source registration, or target class was not found';
  end if;
  if selected_student.lifecycle_status not in ('admitted', 'active') or selected_student.academic_phase <> 'in_class' then
    raise exception using errcode = '23514', message = 'Only active in-class students can be assigned to a class';
  end if;
  if selected_registration.student_id <> new.student_id
     or selected_registration.academic_period_id <> new.academic_period_id
     or selected_registration.registration_status <> 'registered'
     or selected_allocation.academic_period_id <> new.academic_period_id then
    raise exception using errcode = '23514', message = 'The registration and target class must belong to this student and academic period';
  end if;
  if not exists (
    select 1 from public.unit_equivalence_members source_member
    join public.unit_equivalence_members target_member
      on target_member.equivalence_group_id = source_member.equivalence_group_id
     and target_member.status = 'approved'
    where source_member.unit_id = selected_registration.unit_id
      and source_member.status = 'approved'
      and target_member.unit_id = selected_allocation.unit_id
  ) and selected_registration.unit_id <> selected_allocation.unit_id then
    raise exception using errcode = '23514', message = 'The source registration and target class are not an approved equivalent unit';
  end if;
  select programme.department_id into selected_department
    from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
    where cohort.id = selected_student.current_cohort_id;
  select programme.department_id into target_department
    from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
    where cohort.id = selected_allocation.cohort_id;
  if selected_department is null or target_department is distinct from selected_department
     or not public.current_user_can_manage_department(selected_department) then
    raise exception using errcode = '42501', message = 'Not permitted to manage this student';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger student_class_assignments_validate
before insert or update on public.student_class_assignments
for each row execute function public.validate_student_class_assignment();

alter table public.student_class_assignments enable row level security;
revoke all on table public.student_class_assignments from anon, authenticated;
grant select, insert, update on table public.student_class_assignments to authenticated;
create policy student_class_assignments_read on public.student_class_assignments
  for select to authenticated using (exists (
    select 1 from public.students student join public.programmes programme on programme.id = student.programme_id
    where student.id = student_class_assignments.student_id
      and public.current_user_can_access_department(programme.department_id)
  ));
create policy student_class_assignments_insert on public.student_class_assignments
  for insert to authenticated with check (exists (
    select 1 from public.students student join public.programmes programme on programme.id = student.programme_id
    where student.id = student_class_assignments.student_id
      and public.current_user_can_manage_department(programme.department_id)
  ));
create policy student_class_assignments_update on public.student_class_assignments
  for update to authenticated using (exists (
    select 1 from public.students student join public.programmes programme on programme.id = student.programme_id
    where student.id = student_class_assignments.student_id
      and public.current_user_can_manage_department(programme.department_id)
  )) with check (exists (
    select 1 from public.students student join public.programmes programme on programme.id = student.programme_id
    where student.id = student_class_assignments.student_id
      and public.current_user_can_manage_department(programme.department_id)
  ));

comment on table public.student_class_assignments is
  'HOD-approved individual attendance in an existing equivalent-unit class; preserves the student home cohort and class timetable.';
