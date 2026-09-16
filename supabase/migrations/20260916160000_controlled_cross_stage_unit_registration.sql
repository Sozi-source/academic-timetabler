-- Keep programme-stage bindings as the standard curriculum path while allowing
-- HOD-approved additions for carry-overs, late corrections, and accelerated study.

create or replace function public.batch_register_override_units(
  target_academic_period_id uuid,
  target_student_ids uuid[],
  selected_unit_ids uuid[],
  override_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_count integer := 0;
  compatible_count integer := 0;
  created_count integer := 0;
  existing_count integer := 0;
  incompatible_count integer := 0;
begin
  if coalesce(trim(override_reason), '') = '' then
    raise exception using errcode = '22023',
      message = 'An override reason is required for additional or cross-stage units';
  end if;

  if char_length(trim(override_reason)) > 1000 then
    raise exception using errcode = '22023',
      message = 'Override reason must be 1,000 characters or fewer';
  end if;

  if coalesce(cardinality(target_student_ids), 0) = 0
     or coalesce(cardinality(selected_unit_ids), 0) = 0 then
    raise exception using errcode = '22023',
      message = 'Select at least one student and one unit';
  end if;

  if not exists (
    select 1
    from public.academic_periods
    where id = target_academic_period_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'Academic period is not active';
  end if;

  create temporary table _override_students (
    student_id uuid primary key,
    programme_id uuid not null,
    cohort_id uuid not null,
    department_id uuid not null
  ) on commit drop;

  insert into _override_students (student_id, programme_id, cohort_id, department_id)
  select s.id, s.programme_id, s.current_cohort_id, s.department_id
  from public.students s
  where s.id = any(target_student_ids)
    and s.lifecycle_status in ('admitted', 'active')
    and s.current_cohort_id is not null
    and public.current_user_can_manage_department(s.department_id);

  select cardinality(array(select distinct unnest(target_student_ids)))
  into selected_count;

  create temporary table _override_pairs (
    student_id uuid not null,
    programme_id uuid not null,
    cohort_id uuid not null,
    department_id uuid not null,
    unit_id uuid not null,
    primary key (student_id, unit_id)
  ) on commit drop;

  insert into _override_pairs (student_id, programme_id, cohort_id, department_id, unit_id)
  select student.student_id, student.programme_id, student.cohort_id, student.department_id, unit.id
  from _override_students student
  join public.units unit
    on unit.id = any(selected_unit_ids)
   and unit.programme_id = student.programme_id
   and unit.is_active = true;

  select count(distinct student_id) into compatible_count
  from _override_pairs;

  incompatible_count := selected_count - compatible_count;

  insert into public.unit_offerings (
    academic_period_id,
    cohort_id,
    unit_id,
    selection_state,
    status,
    offering_type,
    origin,
    exception_reason,
    is_timetable_enabled,
    weekly_sessions,
    session_duration_minutes
  )
  select distinct
    target_academic_period_id,
    pair.cohort_id,
    pair.unit_id,
    'included',
    'active',
    'classroom',
    'special',
    'HOD-approved cross-stage registration: ' || trim(override_reason),
    true,
    2,
    120
  from _override_pairs pair
  where not exists (
    select 1
    from public.unit_offerings offering
    where offering.academic_period_id = target_academic_period_id
      and offering.cohort_id = pair.cohort_id
      and offering.unit_id = pair.unit_id
      and offering.selection_state = 'included'
      and offering.status <> 'cancelled'
  )
  on conflict do nothing;

  select count(*) into existing_count
  from _override_pairs pair
  where exists (
    select 1
    from public.student_unit_registrations registration
    where registration.student_id = pair.student_id
      and registration.academic_period_id = target_academic_period_id
      and registration.unit_id = pair.unit_id
      and registration.registration_status = 'registered'
  );

  insert into public.student_unit_registrations (
    student_id,
    academic_period_id,
    cohort_id,
    unit_id,
    unit_offering_id,
    registration_status,
    source,
    notes,
    registered_at
  )
  select
    pair.student_id,
    target_academic_period_id,
    pair.cohort_id,
    pair.unit_id,
    offering.id,
    'registered',
    'department_manual',
    'HOD-approved cross-stage registration: ' || trim(override_reason),
    now()
  from _override_pairs pair
  join public.unit_offerings offering
    on offering.academic_period_id = target_academic_period_id
   and offering.cohort_id = pair.cohort_id
   and offering.unit_id = pair.unit_id
   and offering.selection_state = 'included'
   and offering.status <> 'cancelled'
  on conflict (student_id, academic_period_id, unit_id)
  do update set
    cohort_id = excluded.cohort_id,
    unit_offering_id = excluded.unit_offering_id,
    registration_status = 'registered',
    source = 'department_manual',
    notes = excluded.notes,
    registered_at = now();

  get diagnostics created_count = row_count;

  return jsonb_build_object(
    'selected_students', selected_count,
    'eligible_students', compatible_count,
    'registrations_created', greatest(created_count - existing_count, 0),
    'existing_registrations_skipped', existing_count,
    'attention_students', incompatible_count
  );
end;
$$;

revoke all on function public.batch_register_override_units(uuid, uuid[], uuid[], text) from public;
grant execute on function public.batch_register_override_units(uuid, uuid[], uuid[], text) to authenticated;

comment on function public.batch_register_override_units(uuid, uuid[], uuid[], text) is
  'HOD-controlled batch registration for active same-programme units outside a student current stage; a reason is required and persisted on the registration.';
