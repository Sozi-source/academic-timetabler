-- ============================================================
-- Migration: Fix CHN stages and provision Y2S2 offerings
-- Description:
--   1. Move CHN 23xx units from Y1S1 to Y2S3.
--   2. Update academic_period_number of CHN 23xx units to 6.
--   3. Provision unit offerings for CHN 22xx units for CHN JAN/MAR 25 cohort.
-- ============================================================

do $$
declare
  chn_prog_id uuid;
  y2s3_stage_id uuid;
  active_period_id uuid;
  chn_jan25_cohort_id uuid;
  offering_row record;
begin
  -- 1. Locate CHN programme
  select id into chn_prog_id
  from public.programmes
  where code = 'CHN'
  limit 1;

  if chn_prog_id is null then
    return;
  end if;

  -- 2. Locate Y2S3 stage for CHN
  select id into y2s3_stage_id
  from public.programme_stages
  where programme_id = chn_prog_id and code = 'Y2S3'
  limit 1;

  -- 3. Realign CHN 23xx units to Y2S3
  if y2s3_stage_id is not null then
    -- Remove them from any stage they are currently in
    delete from public.programme_stage_units
    where unit_id in (
      select id from public.units
      where programme_id = chn_prog_id and code like 'CHN 23%'
    );

    -- Insert them into Y2S3
    insert into public.programme_stage_units (stage_id, unit_id)
    select y2s3_stage_id, un.id
    from public.units un
    where un.programme_id = chn_prog_id and code like 'CHN 23%';

    -- Update academic_period_number
    update public.units
    set academic_period_number = 6
    where programme_id = chn_prog_id and code like 'CHN 23%';
  end if;

  -- 4. Locate active academic period and CHN JAN/MAR 25 cohort
  select id into active_period_id
  from public.academic_periods
  where status = 'active'
  limit 1;

  select id into chn_jan25_cohort_id
  from public.cohorts
  where programme_id = chn_prog_id
    and upper(trim(name)) = 'CHN JAN/MAR 25'
  limit 1;

  -- 5. Ensure CHN 22xx units have included unit offerings for CHN JAN/MAR 25
  if active_period_id is not null and chn_jan25_cohort_id is not null then
    for offering_row in (
      select id
      from public.units
      where programme_id = chn_prog_id
        and code like 'CHN 22%'
    ) loop
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
      values (
        active_period_id,
        chn_jan25_cohort_id,
        offering_row.id,
        'included',
        'active',
        'classroom',
        'special',
        'Department unit offering',
        true,
        2,
        120
      )
      on conflict do nothing;
    end loop;
  end if;
end $$;
