-- Human Anatomy and Physiology was split into two confirmed shared classes
-- after the 2029-to-2026 allocation correction. Consolidate the two groups
-- into one schedulable class while preserving the existing trainer-pending
-- reservation and its audit history.

do $migration$
declare
  target_period_id uuid;
  target_department_id uuid;
  initial_offering_ids uuid[] := '{}'::uuid[];
  target_offering_ids uuid[] := '{}'::uuid[];
  existing_group_ids uuid[] := '{}'::uuid[];
  keeper_group_id uuid;
  live_allocation_id uuid;
  live_trainer_id uuid;
  audit_user_id uuid;
  merged_cohort_ids uuid[] := '{}'::uuid[];
  participant_count integer := 0;
  merged_cohort_size integer := 0;
  department_count integer := 0;
  duration_count integer := 0;
  live_allocation_count integer := 0;
  maximum_weekly_sessions smallint := 1;
  session_duration smallint := 120;
begin
  select period.id
  into target_period_id
  from public.academic_periods period
  where upper(trim(period.code)) = 'SEP-DEC-26'
  order by (period.status = 'active') desc, period.starts_on desc, period.id
  limit 1;

  if target_period_id is null then
    return;
  end if;

  select
    coalesce(array_agg(offering.id order by offering.id), '{}'::uuid[]),
    count(distinct programme.department_id),
    (array_agg(programme.department_id order by programme.department_id))[1]
  into
    initial_offering_ids,
    department_count,
    target_department_id
  from public.unit_offerings offering
  join public.units unit_record on unit_record.id = offering.unit_id
  join public.cohorts cohort on cohort.id = offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.academic_period_id = target_period_id
    and public.canonical_shared_unit_title(unit_record.name) =
      'human anatomy and physiology'
    and upper(trim(cohort.code)) in (
      'CND-SEP-2025',
      'CND-SEP-2026',
      'DND-SEP-2025',
      'DND-SEP-2026'
    );

  if cardinality(initial_offering_ids) < 2 then
    return;
  end if;

  if department_count <> 1 or target_department_id is null then
    raise exception
      'Human Anatomy and Physiology offerings must belong to one department';
  end if;

  select coalesce(
    (
      array_agg(coalesce(
        offering.reviewed_by,
        offering.updated_by,
        offering.created_by
      )) filter (
        where coalesce(
          offering.reviewed_by,
          offering.updated_by,
          offering.created_by
        ) is not null
      )
    )[1],
    (
      select account.id
      from auth.users account
      order by account.created_at, account.id
      limit 1
    )
  )
  into audit_user_id
  from public.unit_offerings offering
  where offering.id = any(initial_offering_ids);

  if audit_user_id is null then
    raise exception
      'An audit user is required to merge Human Anatomy and Physiology';
  end if;

  select coalesce(
    array_agg(distinct offering.confirmed_shared_offering_id),
    '{}'::uuid[]
  )
  into existing_group_ids
  from public.unit_offerings offering
  where offering.id = any(initial_offering_ids)
    and offering.confirmed_shared_offering_id is not null;

  -- Include every existing member of either split group so no participant is
  -- left attached to the archived duplicate class.
  select coalesce(array_agg(offering.id order by offering.id), '{}'::uuid[])
  into target_offering_ids
  from public.unit_offerings offering
  where offering.id = any(initial_offering_ids)
    or offering.confirmed_shared_offering_id = any(existing_group_ids);

  select
    count(distinct coalesce(offering.session_duration_minutes, 120)),
    max(coalesce(offering.weekly_sessions, unit_record.weekly_sessions, 1))::smallint,
    min(coalesce(offering.session_duration_minutes, 120))::smallint
  into
    duration_count,
    maximum_weekly_sessions,
    session_duration
  from public.unit_offerings offering
  join public.units unit_record on unit_record.id = offering.unit_id
  join public.cohorts cohort on cohort.id = offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.id = any(target_offering_ids)
    and offering.academic_period_id = target_period_id
    and programme.department_id = target_department_id
    and public.canonical_shared_unit_title(unit_record.name) =
      'human anatomy and physiology';

  if duration_count <> 1 then
    raise exception
      'Human Anatomy and Physiology shared classes use different session durations';
  end if;

  if cardinality(existing_group_ids) > 0 then
    select group_id
    into keeper_group_id
    from unnest(existing_group_ids) group_record(group_id)
    order by
      exists (
        select 1
        from public.teaching_allocations allocation
        where allocation.teaching_offering_id = group_record.group_id
          and allocation.status in ('draft', 'active', 'suspended')
      ) desc,
      exists (
        select 1
        from public.unit_offerings offering
        where offering.confirmed_shared_offering_id = group_record.group_id
          and offering.is_provisionally_reserved
      ) desc,
      group_record.group_id::text
    limit 1;
  end if;

  if keeper_group_id is null then
    insert into public.teaching_offerings (
      academic_period_id,
      department_id,
      title,
      shared_class_key,
      weekly_sessions,
      session_duration_minutes,
      status,
      is_timetable_enabled,
      notes
    ) values (
      target_period_id,
      target_department_id,
      'Human Anatomy and Physiology',
      'CONFIRMED-HUMAN-ANATOMY-SEP-DEC-26',
      maximum_weekly_sessions,
      session_duration,
      'draft',
      true,
      'Merged institutional shared class'
    )
    returning id into keeper_group_id;

    existing_group_ids := array[keeper_group_id];
  end if;

  select count(*)
  into live_allocation_count
  from public.teaching_allocations allocation
  where allocation.academic_period_id = target_period_id
    and allocation.status in ('draft', 'active', 'suspended')
    and (
      allocation.teaching_offering_id = any(existing_group_ids)
      or (
        allocation.teaching_offering_id is null
        and exists (
          select 1
          from public.unit_offerings offering
          where offering.id = any(target_offering_ids)
            and offering.cohort_id = allocation.cohort_id
            and offering.unit_id = allocation.unit_id
        )
      )
    );

  if live_allocation_count > 1 then
    raise exception
      'Unassign the duplicate Human Anatomy and Physiology allocations before merging';
  end if;

  select allocation.id, allocation.trainer_id
  into live_allocation_id, live_trainer_id
  from public.teaching_allocations allocation
  where allocation.academic_period_id = target_period_id
    and allocation.status in ('draft', 'active', 'suspended')
    and (
      allocation.teaching_offering_id = any(existing_group_ids)
      or (
        allocation.teaching_offering_id is null
        and exists (
          select 1
          from public.unit_offerings offering
          where offering.id = any(target_offering_ids)
            and offering.cohort_id = allocation.cohort_id
            and offering.unit_id = allocation.unit_id
        )
      )
    )
  limit 1;

  insert into public.teaching_offering_participants (
    teaching_offering_id,
    cohort_id,
    unit_id,
    unit_offering_id,
    is_primary,
    notes
  )
  select
    keeper_group_id,
    offering.cohort_id,
    offering.unit_id,
    offering.id,
    false,
    'Merged Human Anatomy and Physiology shared-class participant'
  from public.unit_offerings offering
  where offering.id = any(target_offering_ids)
  on conflict (teaching_offering_id, cohort_id) do update
  set
    unit_id = excluded.unit_id,
    unit_offering_id = excluded.unit_offering_id,
    notes = excluded.notes,
    updated_at = now();

  if not exists (
    select 1
    from public.teaching_offering_participants participant
    where participant.teaching_offering_id = keeper_group_id
      and participant.is_primary
  ) then
    update public.teaching_offering_participants participant
    set is_primary = true,
        updated_at = now()
    where participant.id = (
      select candidate.id
      from public.teaching_offering_participants candidate
      where candidate.teaching_offering_id = keeper_group_id
      order by candidate.cohort_id, candidate.id
      limit 1
    );
  end if;

  select
    coalesce(array_agg(distinct participant.cohort_id), '{}'::uuid[]),
    count(distinct participant.cohort_id),
    coalesce(sum(cohort.actual_size), 0)
  into
    merged_cohort_ids,
    participant_count,
    merged_cohort_size
  from public.teaching_offering_participants participant
  join public.cohorts cohort on cohort.id = participant.cohort_id
  where participant.teaching_offering_id = keeper_group_id;

  if participant_count < 2 then
    raise exception
      'The merged Human Anatomy and Physiology class requires at least two cohorts';
  end if;

  if live_allocation_id is not null then
    update public.teaching_allocations allocation
    set
      teaching_offering_id = keeper_group_id,
      participant_cohort_ids = merged_cohort_ids,
      combined_cohort_size = merged_cohort_size,
      weekly_sessions = maximum_weekly_sessions,
      session_duration_minutes = session_duration,
      notes = left(concat_ws(
        ' ',
        nullif(trim(allocation.notes), ''),
        'Merged Human Anatomy and Physiology shared class.'
      ), 1500),
      updated_at = now()
    where allocation.id = live_allocation_id;
  end if;

  update public.teaching_offerings shared
  set
    title = 'Human Anatomy and Physiology',
    weekly_sessions = maximum_weekly_sessions,
    session_duration_minutes = session_duration,
    trainer_id = live_trainer_id,
    status = case
      when live_trainer_id is null then 'draft'::public.teaching_allocation_status
      else 'active'::public.teaching_allocation_status
    end,
    is_timetable_enabled = true,
    notes = left(concat_ws(
      ' ',
      nullif(trim(shared.notes), ''),
      'Merged into one shared class for four CND/DND cohorts.'
    ), 1500),
    updated_at = now()
  where shared.id = keeper_group_id;

  update public.unit_offerings offering
  set
    confirmed_shared_offering_id = keeper_group_id,
    weekly_sessions = maximum_weekly_sessions,
    session_duration_minutes = session_duration,
    allocation_status = case
      when live_trainer_id is null then 'unallocated'
      else 'allocated'
    end,
    is_provisionally_reserved =
      live_allocation_id is not null and live_trainer_id is null,
    status = case
      when live_trainer_id is null then 'draft'::public.unit_offering_status
      else 'active'::public.unit_offering_status
    end,
    manually_reviewed = true,
    reviewed_by = audit_user_id,
    reviewed_at = now(),
    updated_at = now()
  where offering.id = any(target_offering_ids);

  delete from public.teaching_offering_participants participant
  where participant.teaching_offering_id = any(existing_group_ids)
    and participant.teaching_offering_id <> keeper_group_id;

  update public.teaching_offerings duplicate
  set
    trainer_id = null,
    status = 'archived'::public.teaching_allocation_status,
    is_timetable_enabled = false,
    notes = left(concat_ws(
      ' ',
      nullif(trim(duplicate.notes), ''),
      'Archived after merge into Human Anatomy and Physiology shared class '
        || keeper_group_id::text || '.'
    ), 1500),
    updated_at = now()
  where duplicate.id = any(existing_group_ids)
    and duplicate.id <> keeper_group_id;
end
$migration$;

comment on table public.teaching_offerings is
  'Schedulable unit delivery; equivalent units may be consolidated into one multi-cohort shared class.';
