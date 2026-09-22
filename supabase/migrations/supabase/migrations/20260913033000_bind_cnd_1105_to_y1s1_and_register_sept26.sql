-- Migration: 20260913033000_bind_cnd_1105_to_y1s1_and_register_sept26.sql
-- Description: Align CND 1105 (Human Anatomy and Physiology) to Year 1 Semester 1 (Y1S1)
-- and register it for all active students in CND SEPT 26 for the active academic period.

do $migration$
declare
  v_cnd_prog_id uuid;
  v_y1s1_stage_id uuid;
  v_y2s1_stage_id uuid;
  v_cnd_1105_id uuid;
  v_active_period_id uuid;
  v_cnd_sep26_cohort_id uuid;
  v_audit_user_id uuid;
  v_registered_count integer := 0;
begin
  -- 1. Get CND programme ID
  select id into v_cnd_prog_id
  from public.programmes
  where upper(trim(code)) = 'CND'
  limit 1;

  if v_cnd_prog_id is null then
    raise notice 'Programme CND not found; skipping migration.';
    return;
  end if;

  -- 2. Get Y1S1 and Y2S1 stage IDs for CND
  select id into v_y1s1_stage_id
  from public.programme_stages
  where programme_id = v_cnd_prog_id
    and (upper(trim(code)) = 'Y1S1' or sequence_number = 1)
  order by sequence_number asc
  limit 1;

  select id into v_y2s1_stage_id
  from public.programme_stages
  where programme_id = v_cnd_prog_id
    and (upper(trim(code)) = 'Y2S1' or sequence_number = 4)
  order by sequence_number asc
  limit 1;

  -- 3. Get CND 1105 unit ID
  select id into v_cnd_1105_id
  from public.units
  where programme_id = v_cnd_prog_id
    and upper(trim(code)) = 'CND 1105'
  limit 1;

  if v_cnd_1105_id is null or v_y1s1_stage_id is null then
    raise notice 'CND 1105 or Y1S1 stage not found; skipping migration.';
    return;
  end if;

  -- 4. Update units table: set academic_period_number = 1 and programme_stage_id = Y1S1
  update public.units
  set
    academic_period_number = 1,
    programme_stage_id = v_y1s1_stage_id,
    updated_at = now()
  where id = v_cnd_1105_id;

  -- 5. Fix programme_stage_units: remove from Y2S1 and bind to Y1S1
  if v_y2s1_stage_id is not null then
    delete from public.programme_stage_units
    where stage_id = v_y2s1_stage_id
      and unit_id = v_cnd_1105_id;
  end if;

  insert into public.programme_stage_units (stage_id, unit_id)
  values (v_y1s1_stage_id, v_cnd_1105_id)
  on conflict do nothing;

  -- 6. Get active academic period
  select id into v_active_period_id
  from public.academic_periods
  where status = 'active'
  order by starts_on desc
  limit 1;

  -- 7. Get CND-SEP-2026 cohort ID
  select id into v_cnd_sep26_cohort_id
  from public.cohorts
  where programme_id = v_cnd_prog_id
    and (upper(trim(code)) = 'CND-SEP-2026' or upper(trim(name)) = 'CND SEPT 26')
  limit 1;

  -- 8. Get audit user
  select id into v_audit_user_id
  from auth.users
  order by created_at asc
  limit 1;

  -- 9. Register CND 1105 for all active students in CND-SEP-2026 for active academic period
  if v_active_period_id is not null and v_cnd_sep26_cohort_id is not null then
    insert into public.student_unit_registrations (
      student_id,
      unit_id,
      cohort_id,
      academic_period_id,
      registration_status,
      registered_at,
      created_by,
      notes
    )
    select
      s.id,
      v_cnd_1105_id,
      v_cnd_sep26_cohort_id,
      v_active_period_id,
      'registered',
      now(),
      v_audit_user_id,
      'Registered via CND 1105 Y1S1 curriculum stage alignment'
    from public.students s
    where s.current_cohort_id = v_cnd_sep26_cohort_id
      and s.lifecycle_status in ('admitted', 'active')
      and not exists (
        select 1
        from public.student_unit_registrations sur
        where sur.student_id = s.id
          and sur.unit_id = v_cnd_1105_id
          and sur.academic_period_id = v_active_period_id
      );

    get diagnostics v_registered_count = row_count;
    raise notice 'Registered CND 1105 for % students in CND SEPT 26.', v_registered_count;
  end if;

end $migration$;
