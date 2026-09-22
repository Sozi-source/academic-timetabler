-- Resolve every imported trainer to the explicit home workspace code supplied
-- in Trainers template version 2.1. Older already-staged batches retain the
-- batch workspace fallback so they can still be completed safely.

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
  target_department_id uuid;
  requested_department_code text;
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
      message = 'You are not authorized to confirm this Trainer import';
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
    requested_department_code := upper(
      trim(coalesce(normalized ->> 'departmentCode', ''))
    );

    if requested_department_code = '' then
      target_department_id := selected_batch.department_id;
    else
      select department.id
      into target_department_id
      from public.departments department
      where upper(trim(department.code)) = requested_department_code
        and department.is_active = true;
    end if;

    if target_department_id is null then
      raise exception using errcode = '22023',
        message = format(
          'No active school / department uses code %s',
          requested_department_code
        );
    end if;

    if not (
      public.current_user_has_role(
        array['system_admin']::public.app_role[]
      )
      or public.current_user_can_manage_department(target_department_id)
    ) then
      raise exception using errcode = '42501',
        message = format(
          'You cannot import a trainer into school / department %s',
          requested_department_code
        );
    end if;

    insert into public.trainers (
      department_id, staff_number, full_name, email, phone_number,
      employment_type, specialization, qualifications,
      workload_role, normal_weekly_hours, maximum_weekly_hours,
      maximum_daily_hours, availability_mode,
      is_active, is_timetable_available, notes, created_by, updated_by
    ) values (
      target_department_id,
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
      auth.uid(),
      auth.uid()
    ) returning id into created_record_id;

    update public.import_rows
    set status = 'imported',
        imported_record_id = created_record_id,
        imported_at = now(),
        row_errors = '[]'::jsonb
    where id = staged_row.id;

    imported_total := imported_total + 1;
  end loop;

  perform public.refresh_import_batch_counts(target_batch_id);

  update public.import_batches
  set status = case
        when skipped_total > 0
          then 'completed_with_errors'::public.import_batch_status
        else 'completed'::public.import_batch_status
      end,
      failure_message = null,
      completed_at = now(),
      validation_summary = coalesce(validation_summary, '{}'::jsonb)
        || jsonb_build_object(
          'confirmed_at', now(),
          'confirmed_by', auth.uid(),
          'trainer_department_source', 'row_department_code'
        )
  where id = target_batch_id;

  return query
  select target_batch_id, imported_total, skipped_total, 0;
end;
$$;

revoke all
on function public.import_valid_trainer_rows(uuid)
from public;

grant execute
on function public.import_valid_trainer_rows(uuid)
to authenticated;

comment on function public.import_valid_trainer_rows(uuid) is
  'Imports validated Trainer rows into each row home school / department, with active-workspace enforcement for non-system administrators.';
