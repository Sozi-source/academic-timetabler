-- ============================================================
-- Migration: Fix Unit Registration Pipeline & Sept 26 Intake Stages
-- Description:
--   1. Assigns Y1S1 stage to DNDT-SEP-2026 and its enrolled students.
--   2. Enhances batch_register_expected_student_units to coalesce
--      student stage with cohort stage, ensuring students without
--      explicit stage override inherit the cohort's active stage.
--   3. Auto-registers expected Y1S1 units for DNDT SEPT 26 students.
-- ============================================================

-- 1. Ensure DNDT-SEP-2026 cohort is assigned to Y1S1
update public.cohorts
set current_stage_id = '356a135b-a1ae-48ae-b630-fdbd5106af6a',
    updated_at = now()
where id = '51a9729f-398f-47db-86a7-40501f4037df'
  and current_stage_id is null;

-- 2. Ensure all students in DNDT-SEP-2026 inherit Y1S1
update public.students
set current_stage_id = '356a135b-a1ae-48ae-b630-fdbd5106af6a',
    updated_at = now()
where current_cohort_id = '51a9729f-398f-47db-86a7-40501f4037df'
  and current_stage_id is null;

-- 3. Also update any active students in any cohort whose current_stage_id is null
--    but whose cohort has a valid current_stage_id
update public.students s
set current_stage_id = c.current_stage_id,
    updated_at = now()
from public.cohorts c
where s.current_cohort_id = c.id
  and s.current_stage_id is null
  and c.current_stage_id is not null;

-- 4. Resilient batch_register_expected_student_units function
create or replace function public.batch_register_expected_student_units(
  target_academic_period_id uuid,
  target_cohort_id uuid default null,
  selected_student_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_count integer := 0;
  eligible_count integer := 0;
  attention_count integer := 0;
  inserted_count integer := 0;
  existing_count integer := 0;
  has_department_id boolean := false;
  has_cohort_id boolean := false;
  has_stage_id boolean := false;
  insert_sql text;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required';
  end if;

  if not public.current_user_has_role(
    array['hod','system_admin']::public.app_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only an HOD or system administrator can perform batch unit registration';
  end if;

  if target_academic_period_id is null then
    raise exception 'Academic period is required';
  end if;

  if target_cohort_id is null
     and coalesce(cardinality(selected_student_ids), 0) = 0 then
    raise exception 'Select a cohort or at least one student';
  end if;

  create temporary table _batch_students (
    student_id uuid primary key,
    programme_id uuid not null,
    cohort_id uuid,
    stage_id uuid
  ) on commit drop;

  -- Select students with resilient fallback to cohort's current_stage_id
  insert into _batch_students (
    student_id,
    programme_id,
    cohort_id,
    stage_id
  )
  select
    s.id,
    s.programme_id,
    s.current_cohort_id,
    coalesce(s.current_stage_id, c.current_stage_id)
  from public.students s
  left join public.cohorts c on c.id = s.current_cohort_id
  where s.lifecycle_status in ('admitted','active')
    and (
      (
        coalesce(cardinality(selected_student_ids), 0) > 0
        and s.id = any(selected_student_ids)
      )
      or
      (
        coalesce(cardinality(selected_student_ids), 0) = 0
        and target_cohort_id is not null
        and s.current_cohort_id = target_cohort_id
      )
    );

  select count(*) into selected_count
  from _batch_students;

  create temporary table _batch_expected (
    student_id uuid not null,
    programme_id uuid not null,
    cohort_id uuid not null,
    stage_id uuid not null,
    unit_id uuid not null,
    primary key (student_id, unit_id)
  ) on commit drop;

  insert into _batch_expected (
    student_id,
    programme_id,
    cohort_id,
    stage_id,
    unit_id
  )
  select distinct
    bs.student_id,
    bs.programme_id,
    bs.cohort_id,
    bs.stage_id,
    psu.unit_id
  from _batch_students bs
  join public.programme_stage_units psu
    on psu.stage_id = bs.stage_id
  join public.units u
    on u.id = psu.unit_id
   and u.programme_id = bs.programme_id
  join public.unit_offerings uo
    on uo.unit_id = psu.unit_id
   and uo.cohort_id = bs.cohort_id
   and uo.academic_period_id = target_academic_period_id
   and uo.selection_state = 'included'
   and uo.status <> 'cancelled'
  where bs.stage_id is not null
    and bs.cohort_id is not null;

  select count(distinct student_id)
  into eligible_count
  from _batch_expected;

  attention_count := selected_count - eligible_count;

  select count(*)
  into existing_count
  from _batch_expected be
  where exists (
    select 1
    from public.student_unit_registrations sur
    where sur.student_id = be.student_id
      and sur.academic_period_id = target_academic_period_id
      and sur.unit_id = be.unit_id
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='student_unit_registrations'
      and column_name='department_id'
  ) into has_department_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='student_unit_registrations'
      and column_name='cohort_id'
  ) into has_cohort_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='student_unit_registrations'
      and column_name='stage_id'
  ) into has_stage_id;

  -- Build a compatibility-aware insert for the current registration table.
  insert_sql := 'insert into public.student_unit_registrations (';

  if has_department_id then
    insert_sql := insert_sql || 'department_id,';
  end if;

  insert_sql := insert_sql ||
    'student_id,academic_period_id,unit_id,registration_status';

  if has_cohort_id then
    insert_sql := insert_sql || ',cohort_id';
  end if;

  if has_stage_id then
    insert_sql := insert_sql || ',stage_id';
  end if;

  insert_sql := insert_sql || ') select ';

  if has_department_id then
    insert_sql := insert_sql || 'p.department_id,';
  end if;

  insert_sql := insert_sql ||
    'be.student_id,$1,be.unit_id,''registered''';

  if has_cohort_id then
    insert_sql := insert_sql || ',be.cohort_id';
  end if;

  if has_stage_id then
    insert_sql := insert_sql || ',be.stage_id';
  end if;

  insert_sql := insert_sql ||
    ' from _batch_expected be
      join public.programmes p on p.id = be.programme_id
      where not exists (
        select 1
        from public.student_unit_registrations sur
        where sur.student_id = be.student_id
          and sur.academic_period_id = $1
          and sur.unit_id = be.unit_id
      )
      on conflict do nothing';

  execute insert_sql using target_academic_period_id;
  get diagnostics inserted_count = row_count;

  -- If any students registered through cohort fallback lacked an individual current_stage_id,
  -- backfill s.current_stage_id so future markbooks and portals recognize it.
  update public.students s
  set current_stage_id = be.stage_id,
      updated_at = now()
  from (
    select distinct student_id, stage_id from _batch_expected
  ) be
  where s.id = be.student_id
    and s.current_stage_id is null;

  return jsonb_build_object(
    'selected_students', selected_count,
    'eligible_students', eligible_count,
    'attention_students', attention_count,
    'registrations_created', inserted_count,
    'existing_registrations_skipped', existing_count
  );
end;
$$;

-- 5. Auto-register DNDT SEPT 26 students directly
insert into public.student_unit_registrations (
  student_id,
  academic_period_id,
  cohort_id,
  unit_id,
  unit_offering_id,
  registration_status,
  source,
  registered_at
)
select
  s.id,
  uo.academic_period_id,
  s.current_cohort_id,
  uo.unit_id,
  uo.id,
  'registered',
  'department_manual',
  now()
from public.students s
join public.cohorts c on c.id = s.current_cohort_id
join public.unit_offerings uo
  on uo.cohort_id = c.id
 and uo.academic_period_id = '2f94652a-1c40-4359-bd1b-21f25f92d2bf'
 and uo.selection_state = 'included'
 and uo.status <> 'cancelled'
where c.id = '51a9729f-398f-47db-86a7-40501f4037df'
  and not exists (
    select 1
    from public.student_unit_registrations sur
    where sur.student_id = s.id
      and sur.academic_period_id = uo.academic_period_id
      and sur.unit_id = uo.unit_id
  )
on conflict do nothing;
