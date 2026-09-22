-- Standardized fixed-header bulk imports with minimal required fields.

create or replace function public.import_valid_programme_rows(
  target_batch_id uuid
)
returns table (
  batch_id uuid,
  imported_count integer,
  skipped_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_batch public.import_batches%rowtype;
  staged_row public.import_rows%rowtype;
  normalized jsonb;
  created_record_id uuid;
  imported_total integer := 0;
  skipped_total integer := 0;
begin
  select * into selected_batch
  from public.import_batches
  where id = target_batch_id
  for update;

  if selected_batch.id is null then
    raise exception 'The requested import batch was not found';
  end if;
  if selected_batch.entity_type <> 'programmes' then
    raise exception 'The selected batch is not a Programme import';
  end if;
  if selected_batch.status <> 'validated' then
    raise exception 'Only validated Programme imports can be confirmed';
  end if;
  if not public.current_user_can_manage_department(selected_batch.department_id) then
    raise exception using errcode = '42501',
      message = 'You are not authorized to import programmes for this department';
  end if;

  update public.import_batches
  set status = 'importing', failure_message = null
  where id = target_batch_id;

  update public.import_rows
  set status = 'skipped'
  where import_batch_id = target_batch_id
    and status in ('invalid', 'duplicate');
  get diagnostics skipped_total = row_count;

  for staged_row in
    select * from public.import_rows
    where import_batch_id = target_batch_id
      and status = 'valid'
    order by source_row_number
    for update
  loop
    normalized := staged_row.normalized_data;

    insert into public.programmes (
      department_id, code, name, short_name, award_level,
      awarding_body, duration_value, duration_unit,
      total_academic_periods, maximum_cohort_size,
      is_active, is_timetable_available, notes,
      created_by, updated_by
    ) values (
      selected_batch.department_id,
      normalized ->> 'code',
      normalized ->> 'name',
      nullif(normalized ->> 'shortName', ''),
      coalesce(normalized ->> 'awardLevel', 'diploma')::public.programme_award_level,
      nullif(normalized ->> 'awardingBody', ''),
      coalesce((normalized ->> 'durationValue')::numeric, 3),
      coalesce(normalized ->> 'durationUnit', 'years')::public.programme_duration_unit,
      coalesce((normalized ->> 'totalAcademicPeriods')::smallint, 9),
      nullif(normalized ->> 'maximumCohortSize', '')::integer,
      true,
      coalesce((normalized ->> 'timetableAvailable')::boolean, true),
      nullif(normalized ->> 'notes', ''),
      auth.uid(), auth.uid()
    ) returning id into created_record_id;

    update public.import_rows
    set status = 'imported',
        imported_record_id = created_record_id,
        imported_at = now(), row_errors = '[]'::jsonb
    where id = staged_row.id;
    imported_total := imported_total + 1;
  end loop;

  perform public.refresh_import_batch_counts(target_batch_id);
  update public.import_batches
  set status = case when skipped_total > 0
      then 'completed_with_errors' else 'completed' end,
      failure_message = null, completed_at = now(),
      validation_summary = coalesce(validation_summary, '{}'::jsonb)
        || jsonb_build_object('confirmed_at', now(), 'confirmed_by', auth.uid())
  where id = target_batch_id;

  return query select target_batch_id, imported_total, skipped_total, 0;
end;
$$;

create or replace function public.import_valid_cohort_rows(
  target_batch_id uuid
)
returns table (
  batch_id uuid,
  imported_count integer,
  skipped_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_batch public.import_batches%rowtype;
  staged_row public.import_rows%rowtype;
  normalized jsonb;
  parent_programme public.programmes%rowtype;
  created_record_id uuid;
  intake_date_value date;
  intake_position integer;
  final_position integer;
  active_position integer;
  active_count integer;
  completion_date date;
  current_period smallint;
  imported_total integer := 0;
  skipped_total integer := 0;
begin
  select * into selected_batch
  from public.import_batches
  where id = target_batch_id
  for update;

  if selected_batch.id is null then
    raise exception 'The requested import batch was not found';
  end if;
  if selected_batch.entity_type <> 'cohorts' then
    raise exception 'The selected batch is not a Cohort import';
  end if;
  if selected_batch.status <> 'validated' then
    raise exception 'Only validated Cohort imports can be confirmed';
  end if;
  if not public.current_user_can_manage_department(selected_batch.department_id) then
    raise exception using errcode = '42501',
      message = 'You are not authorized to import cohorts for this department';
  end if;

  select count(*)::integer into active_count
  from public.academic_periods
  where status = 'active';
  if active_count <> 1 then
    raise exception 'Exactly one active Academic Period is required before importing cohorts';
  end if;

  update public.import_batches
  set status = 'importing', failure_message = null
  where id = target_batch_id;
  update public.import_rows
  set status = 'skipped'
  where import_batch_id = target_batch_id
    and status in ('invalid', 'duplicate');
  get diagnostics skipped_total = row_count;

  for staged_row in
    select * from public.import_rows
    where import_batch_id = target_batch_id
      and status = 'valid'
    order by source_row_number
    for update
  loop
    normalized := staged_row.normalized_data;
    intake_date_value := (normalized ->> 'intakeDate')::date;

    select * into parent_programme
    from public.programmes
    where department_id = selected_batch.department_id
      and lower(trim(code)) = lower(trim(normalized ->> 'programmeCode'));
    if parent_programme.id is null then
      raise exception 'Programme % was not found in the active department',
        normalized ->> 'programmeCode';
    end if;

    select ordered.position into intake_position
    from (
      select starts_on, ends_on,
        row_number() over (order by starts_on, sequence_number, id)::integer as position
      from public.academic_periods
    ) ordered
    where ordered.starts_on <= intake_date_value
      and ordered.ends_on >= intake_date_value;
    if intake_position is null then
      raise exception 'No Academic Period covers intake date %', intake_date_value;
    end if;

    final_position := intake_position + parent_programme.total_academic_periods - 1;
    select ordered.ends_on into completion_date
    from (
      select ends_on,
        row_number() over (order by starts_on, sequence_number, id)::integer as position
      from public.academic_periods
    ) ordered
    where ordered.position = final_position;
    if completion_date is null then
      raise exception 'Insufficient future Academic Periods for cohort %',
        normalized ->> 'code';
    end if;

    select ordered.position into active_position
    from (
      select status,
        row_number() over (order by starts_on, sequence_number, id)::integer as position
      from public.academic_periods
    ) ordered
    where ordered.status = 'active';

    current_period := case
      when active_position < intake_position then 1
      when active_position > final_position
        then parent_programme.total_academic_periods::smallint
      else (active_position - intake_position + 1)::smallint
    end;

    insert into public.cohorts (
      programme_id, code, name, intake_date,
      expected_completion_date, current_academic_period_number,
      planned_size, actual_size, status,
      is_timetable_available, notes, created_by, updated_by
    ) values (
      parent_programme.id,
      normalized ->> 'code',
      normalized ->> 'name',
      intake_date_value,
      completion_date,
      current_period,
      null,
      coalesce((normalized ->> 'actualSize')::integer, 0),
      coalesce(normalized ->> 'status', 'planned')::public.cohort_status,
      coalesce(normalized ->> 'status', 'planned') in ('planned', 'active'),
      nullif(normalized ->> 'notes', ''),
      auth.uid(), auth.uid()
    ) returning id into created_record_id;

    update public.import_rows
    set status = 'imported',
        imported_record_id = created_record_id,
        imported_at = now(), row_errors = '[]'::jsonb
    where id = staged_row.id;
    imported_total := imported_total + 1;
  end loop;

  perform public.refresh_import_batch_counts(target_batch_id);
  update public.import_batches
  set status = case when skipped_total > 0
      then 'completed_with_errors' else 'completed' end,
      failure_message = null, completed_at = now(),
      validation_summary = coalesce(validation_summary, '{}'::jsonb)
        || jsonb_build_object('confirmed_at', now(), 'confirmed_by', auth.uid())
  where id = target_batch_id;

  return query select target_batch_id, imported_total, skipped_total, 0;
end;
$$;

-- Extend Trainer import to preserve the enterprise workload configuration.
create or replace function public.import_valid_trainer_rows(
  target_batch_id uuid
)
returns table (
  batch_id uuid,
  imported_count integer,
  skipped_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_batch public.import_batches%rowtype;
  staged_row public.import_rows%rowtype;
  normalized jsonb;
  created_record_id uuid;
  imported_total integer := 0;
  skipped_total integer := 0;
begin
  select * into selected_batch
  from public.import_batches
  where id = target_batch_id
  for update;

  if selected_batch.id is null then
    raise exception 'The requested import batch was not found';
  end if;
  if selected_batch.entity_type <> 'trainers' then
    raise exception 'The selected batch is not a Trainer import';
  end if;
  if selected_batch.status <> 'validated' then
    raise exception 'Only validated Trainer imports can be confirmed';
  end if;
  if not public.current_user_can_manage_department(selected_batch.department_id) then
    raise exception using errcode = '42501',
      message = 'You are not authorized to import trainers for this department';
  end if;

  update public.import_batches
  set status = 'importing', failure_message = null
  where id = target_batch_id;
  update public.import_rows
  set status = 'skipped'
  where import_batch_id = target_batch_id
    and status in ('invalid', 'duplicate');
  get diagnostics skipped_total = row_count;

  for staged_row in
    select * from public.import_rows
    where import_batch_id = target_batch_id
      and status = 'valid'
    order by source_row_number
    for update
  loop
    normalized := staged_row.normalized_data;

    insert into public.trainers (
      department_id, staff_number, full_name, email, phone_number,
      employment_type, specialization, qualifications,
      workload_role, normal_weekly_hours, maximum_weekly_hours,
      maximum_daily_hours, availability_mode,
      is_active, is_timetable_available, notes, created_by, updated_by
    ) values (
      selected_batch.department_id,
      normalized ->> 'staffNumber',
      normalized ->> 'fullName',
      nullif(normalized ->> 'email', ''),
      nullif(normalized ->> 'phoneNumber', ''),
      coalesce(normalized ->> 'employmentType', 'full_time')::public.trainer_employment_type,
      nullif(normalized ->> 'specialization', ''),
      nullif(normalized ->> 'qualifications', ''),
      coalesce(normalized ->> 'workloadRole', 'full_time_trainer'),
      coalesce((normalized ->> 'normalWeeklyHours')::numeric, 20),
      coalesce((normalized ->> 'maximumWeeklyHours')::numeric, 24),
      coalesce((normalized ->> 'maximumDailyHours')::numeric, 6),
      coalesce(normalized ->> 'availabilityMode', 'generally_available'),
      true,
      coalesce((normalized ->> 'timetableAvailable')::boolean, true),
      nullif(normalized ->> 'notes', ''),
      auth.uid(), auth.uid()
    ) returning id into created_record_id;

    update public.import_rows
    set status = 'imported',
        imported_record_id = created_record_id,
        imported_at = now(), row_errors = '[]'::jsonb
    where id = staged_row.id;
    imported_total := imported_total + 1;
  end loop;

  perform public.refresh_import_batch_counts(target_batch_id);
  update public.import_batches
  set status = case when skipped_total > 0
      then 'completed_with_errors' else 'completed' end,
      failure_message = null, completed_at = now(),
      validation_summary = coalesce(validation_summary, '{}'::jsonb)
        || jsonb_build_object('confirmed_at', now(), 'confirmed_by', auth.uid())
  where id = target_batch_id;

  return query select target_batch_id, imported_total, skipped_total, 0;
end;
$$;

revoke all on function public.import_valid_programme_rows(uuid) from public;
revoke all on function public.import_valid_cohort_rows(uuid) from public;
revoke all on function public.import_valid_trainer_rows(uuid) from public;
grant execute on function public.import_valid_programme_rows(uuid) to authenticated;
grant execute on function public.import_valid_cohort_rows(uuid) to authenticated;
grant execute on function public.import_valid_trainer_rows(uuid) to authenticated;

comment on function public.import_valid_programme_rows(uuid) is
  'Atomically imports validated standardized Programme rows into the batch department.';
comment on function public.import_valid_cohort_rows(uuid) is
  'Atomically imports validated standardized Cohort rows and derives progression from configured Academic Periods.';
