-- ============================================================
-- v12.12.0 - Batch student unit registration
-- Supports selected students OR an entire cohort.
-- Uses Programme -> Current Stage -> Stage Units -> Units on Offer.
-- ============================================================

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
    s.current_stage_id
  from public.students s
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

  return jsonb_build_object(
    'selected_students', selected_count,
    'eligible_students', eligible_count,
    'attention_students', attention_count,
    'registrations_created', inserted_count,
    'existing_registrations_skipped', existing_count
  );
end;
$$;

revoke all
on function public.batch_register_expected_student_units(uuid, uuid, uuid[])
from public, anon;

grant execute
on function public.batch_register_expected_student_units(uuid, uuid, uuid[])
to authenticated;

comment on function public.batch_register_expected_student_units(uuid, uuid, uuid[]) is
  'Batch-registers expected stage units for selected students or an entire cohort, restricted to units currently on offer.';
