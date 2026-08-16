-- Rejoin equivalent classes that acquired a second trainer-pending allocation
-- after the original shared class had already been assigned. The assigned
-- allocation remains authoritative and its workload continues to count once.

create or replace function public.reconcile_previous_trainer_assignments(
  p_academic_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  target_period public.academic_periods%rowtype;
  pending record;
  assigned_candidate_ids uuid[];
  historical_trainer_ids uuid[];
  assigned_allocation public.teaching_allocations%rowtype;
  target_shared_offering_id uuid;
  participant_ids uuid[];
  participant_size integer;
  group_weekly_sessions smallint;
  merged_count integer := 0;
  restored_count integer := 0;
  review_count integer := 0;
  review_items jsonb := '[]'::jsonb;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before reconciling allocations';
  end if;

  select period.*
  into target_period
  from public.academic_periods period
  where period.id = p_academic_period_id
    and period.status in ('planned', 'active');

  if target_period.id is null then
    raise exception 'Select a planned or active Academic Period';
  end if;

  for pending in
    select
      allocation.*,
      unit_record.code as unit_code,
      unit_record.name as unit_name,
      cohort.code as cohort_code
    from public.teaching_allocations allocation
    join public.cohorts cohort on cohort.id = allocation.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    join public.units unit_record on unit_record.id = allocation.unit_id
    where allocation.academic_period_id = p_academic_period_id
      and allocation.status in ('draft', 'active')
      and allocation.trainer_id is null
      and allocation.is_timetable_enabled = true
      and programme.department_id = active_department
    order by allocation.created_at, allocation.id
    for update of allocation
  loop
    -- First handle one current assigned class plus a separated equivalent
    -- trainer-pending class.
    select coalesce(
      array_agg(distinct candidate.id order by candidate.id),
      '{}'::uuid[]
    )
    into assigned_candidate_ids
    from public.teaching_allocations candidate
    join public.cohorts candidate_cohort
      on candidate_cohort.id = candidate.cohort_id
    join public.programmes candidate_programme
      on candidate_programme.id = candidate_cohort.programme_id
    join public.units candidate_unit on candidate_unit.id = candidate.unit_id
    where candidate.id <> pending.id
      and candidate.academic_period_id = p_academic_period_id
      and candidate.status in ('draft', 'active')
      and candidate.is_timetable_enabled = true
      and candidate.trainer_id is not null
      and candidate_programme.department_id = active_department
      and candidate.session_duration_minutes = pending.session_duration_minutes
      and public.canonical_shared_unit_title(candidate_unit.name) =
        public.canonical_shared_unit_title(pending.unit_name);

    if cardinality(assigned_candidate_ids) = 1 then
      if exists (
        select 1
        from public.scheduled_sessions session
        where session.teaching_allocation_id = pending.id
          and (session.is_locked = true or session.status = 'locked')
      ) then
        review_count := review_count + 1;
        review_items := review_items || jsonb_build_array(jsonb_build_object(
          'allocationId', pending.id,
          'unitCode', pending.unit_code,
          'unitName', pending.unit_name,
          'cohortCode', pending.cohort_code,
          'reason', 'Unlock the pending timetable session before merging it'
        ));
        continue;
      end if;

      select allocation.*
      into assigned_allocation
      from public.teaching_allocations allocation
      where allocation.id = assigned_candidate_ids[1]
      for update;

      if exists (
        select 1
        from public.scheduled_sessions session
        where session.teaching_allocation_id = assigned_allocation.id
          and (session.is_locked = true or session.status = 'locked')
      ) or exists (
        select 1
        from public.timetable_versions version
        cross join lateral jsonb_array_elements(version.snapshot) snapshot_session
        join public.scheduled_sessions session
          on snapshot_session ->> 'id' = session.id::text
        where version.academic_period_id = p_academic_period_id
          and version.status in ('under_review', 'approved', 'published')
          and session.teaching_allocation_id = assigned_allocation.id
      ) then
        review_count := review_count + 1;
        review_items := review_items || jsonb_build_array(jsonb_build_object(
          'allocationId', pending.id,
          'unitCode', pending.unit_code,
          'unitName', pending.unit_name,
          'cohortCode', pending.cohort_code,
          'reason', 'Reopen or unlock the assigned timetable session before merging this class'
        ));
        continue;
      end if;

      -- The assigned placement may be valid for its old participant list but
      -- clash after another cohort is rejoined. Keep the trainer allocation,
      -- clear only the editable draft placement, then regenerate safely.
      update public.scheduled_sessions session
      set
        status = 'cancelled',
        conflict_state = 'clear',
        notes = left(concat_ws(
          ' ',
          nullif(trim(session.notes), ''),
          'Placement cleared because shared-class participants changed; regenerate the draft timetable.'
        ), 1000),
        updated_at = now(),
        updated_by = auth.uid()
      where session.teaching_allocation_id = assigned_allocation.id
        and session.status not in ('cancelled', 'archived');

      -- Remove the redundant trainer-pending draft from the active timetable
      -- before expanding the assigned class participant list. Otherwise the
      -- participant refresh correctly sees both sessions and raises a clash.
      update public.scheduled_sessions session
      set
        status = 'cancelled',
        conflict_state = 'clear',
        notes = left(concat_ws(
          ' ',
          nullif(trim(session.notes), ''),
          'Cancelled before rejoining the pending duplicate to its assigned shared class.'
        ), 1000),
        updated_at = now(),
        updated_by = auth.uid()
      where session.teaching_allocation_id = pending.id
        and session.status not in ('cancelled', 'archived');

      target_shared_offering_id := assigned_allocation.teaching_offering_id;

      if target_shared_offering_id is null then
        insert into public.teaching_offerings (
          academic_period_id,
          department_id,
          title,
          shared_class_key,
          trainer_id,
          preferred_room_id,
          delivery_mode,
          weekly_sessions,
          session_duration_minutes,
          status,
          is_timetable_enabled,
          notes
        ) values (
          p_academic_period_id,
          active_department,
          pending.unit_name,
          'RECONCILED-' || upper(substr(md5(
            p_academic_period_id::text || ':' || assigned_allocation.id::text
          ), 1, 20)),
          assigned_allocation.trainer_id,
          assigned_allocation.preferred_room_id,
          assigned_allocation.delivery_mode,
          greatest(assigned_allocation.weekly_sessions, pending.weekly_sessions),
          assigned_allocation.session_duration_minutes,
          'active',
          true,
          'Recreated shared class from an assigned class and its separated equivalent'
        )
        returning id into target_shared_offering_id;
      else
        update public.teaching_offerings offering
        set
          trainer_id = assigned_allocation.trainer_id,
          status = 'active',
          is_timetable_enabled = true,
          shared_class_key = coalesce(
            offering.shared_class_key,
            'RECONCILED-' || upper(substr(md5(
              p_academic_period_id::text || ':' || offering.id::text
            ), 1, 20))
          ),
          updated_at = now(),
          updated_by = auth.uid()
        where offering.id = target_shared_offering_id;
      end if;

      -- Add every equivalent Unit on Offer to the assigned class.
      insert into public.teaching_offering_participants (
        teaching_offering_id,
        cohort_id,
        unit_id,
        unit_offering_id,
        is_primary,
        notes
      )
      select
        target_shared_offering_id,
        offering.cohort_id,
        offering.unit_id,
        offering.id,
        false,
        'Rejoined to its assigned equivalent shared class'
      from public.unit_offerings offering
      join public.cohorts cohort on cohort.id = offering.cohort_id
      join public.programmes programme on programme.id = cohort.programme_id
      join public.units unit_record on unit_record.id = offering.unit_id
      where offering.academic_period_id = p_academic_period_id
        and offering.is_timetable_enabled = true
        and programme.department_id = active_department
        and coalesce(offering.session_duration_minutes, 120) =
          assigned_allocation.session_duration_minutes
        and public.canonical_shared_unit_title(unit_record.name) =
          public.canonical_shared_unit_title(pending.unit_name)
      on conflict (teaching_offering_id, cohort_id)
      do update set
        unit_id = excluded.unit_id,
        unit_offering_id = excluded.unit_offering_id,
        notes = excluded.notes,
        updated_at = now(),
        updated_by = auth.uid();

      if not exists (
        select 1
        from public.teaching_offering_participants participant
        where participant.teaching_offering_id = target_shared_offering_id
          and participant.is_primary = true
      ) then
        update public.teaching_offering_participants participant
        set is_primary = true, updated_at = now(), updated_by = auth.uid()
        where participant.id = (
          select member.id
          from public.teaching_offering_participants member
          where member.teaching_offering_id = target_shared_offering_id
          order by member.created_at, member.id
          limit 1
        );
      end if;

      select
        array_agg(distinct participant.cohort_id order by participant.cohort_id),
        coalesce(sum(cohort.actual_size), 0)
      into participant_ids, participant_size
      from public.teaching_offering_participants participant
      join public.cohorts cohort on cohort.id = participant.cohort_id
      where participant.teaching_offering_id = target_shared_offering_id;

      select max(coalesce(offering.weekly_sessions, 1))::smallint
      into group_weekly_sessions
      from public.unit_offerings offering
      join public.cohorts cohort on cohort.id = offering.cohort_id
      join public.programmes programme on programme.id = cohort.programme_id
      join public.units unit_record on unit_record.id = offering.unit_id
      where offering.academic_period_id = p_academic_period_id
        and programme.department_id = active_department
        and coalesce(offering.session_duration_minutes, 120) =
          assigned_allocation.session_duration_minutes
        and public.canonical_shared_unit_title(unit_record.name) =
          public.canonical_shared_unit_title(pending.unit_name);

      group_weekly_sessions := greatest(
        coalesce(group_weekly_sessions, 1),
        assigned_allocation.weekly_sessions,
        pending.weekly_sessions
      );

      update public.teaching_allocations allocation
      set
        teaching_offering_id = target_shared_offering_id,
        participant_cohort_ids = participant_ids,
        combined_cohort_size = participant_size,
        weekly_sessions = group_weekly_sessions,
        notes = left(concat_ws(
          ' ',
          nullif(trim(allocation.notes), ''),
          'Separated equivalent class rejoined; workload counted once.'
        ), 1500),
        updated_at = now(),
        updated_by = auth.uid()
      where allocation.id = assigned_allocation.id;

      update public.teaching_offerings offering
      set
        trainer_id = assigned_allocation.trainer_id,
        weekly_sessions = group_weekly_sessions,
        status = 'active',
        is_timetable_enabled = true,
        updated_at = now(),
        updated_by = auth.uid()
      where offering.id = target_shared_offering_id;

      update public.scheduled_sessions session
      set
        status = 'cancelled',
        conflict_state = 'clear',
        notes = left(concat_ws(
          ' ',
          nullif(trim(session.notes), ''),
          'Cancelled after the pending duplicate was rejoined to the assigned shared class.'
        ), 1000),
        updated_at = now(),
        updated_by = auth.uid()
      where session.teaching_allocation_id = pending.id
        and session.status not in ('cancelled', 'archived');

      update public.teaching_allocations allocation
      set
        status = 'archived',
        is_timetable_enabled = false,
        notes = left(concat_ws(
          ' ',
          nullif(trim(allocation.notes), ''),
          'Archived as a redundant trainer-pending duplicate of allocation '
            || assigned_allocation.id::text || '.'
        ), 1500),
        updated_at = now(),
        updated_by = auth.uid()
      where allocation.id = pending.id;

      update public.unit_offerings offering
      set
        confirmed_shared_offering_id = target_shared_offering_id,
        allocation_status = 'allocated',
        is_provisionally_reserved = false,
        weekly_sessions = group_weekly_sessions,
        status = 'active',
        manually_reviewed = true,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
      from public.cohorts cohort
      join public.programmes programme on programme.id = cohort.programme_id
      join public.units unit_record on unit_record.programme_id = cohort.programme_id
      where offering.cohort_id = cohort.id
        and offering.unit_id = unit_record.id
        and offering.academic_period_id = p_academic_period_id
        and programme.department_id = active_department
        and coalesce(offering.session_duration_minutes, 120) =
          assigned_allocation.session_duration_minutes
        and public.canonical_shared_unit_title(unit_record.name) =
          public.canonical_shared_unit_title(pending.unit_name);

      if pending.teaching_offering_id is not null
        and pending.teaching_offering_id <> target_shared_offering_id then
        update public.teaching_offerings offering
        set
          trainer_id = null,
          status = 'archived',
          is_timetable_enabled = false,
          notes = left(concat_ws(
            ' ',
            nullif(trim(offering.notes), ''),
            'Archived after its participants were rejoined to shared class '
              || target_shared_offering_id::text || '.'
          ), 1500),
          updated_at = now(),
          updated_by = auth.uid()
        where offering.id = pending.teaching_offering_id
          and not exists (
            select 1
            from public.teaching_allocations allocation
            where allocation.teaching_offering_id = offering.id
              and allocation.status in ('draft', 'active', 'suspended')
          );
      end if;

      merged_count := merged_count + 1;
      continue;
    end if;

    if cardinality(assigned_candidate_ids) > 1 then
      review_count := review_count + 1;
      review_items := review_items || jsonb_build_array(jsonb_build_object(
        'allocationId', pending.id,
        'unitCode', pending.unit_code,
        'unitName', pending.unit_name,
        'cohortCode', pending.cohort_code,
        'candidateCount', cardinality(assigned_candidate_ids),
        'reason', 'More than one current assigned class has the same subject title'
      ));
      continue;
    end if;

    -- Otherwise restore only an exact or participant-overlapping trainer from
    -- the corrected SEP-DEC-29 history.
    select coalesce(
      array_agg(distinct history.trainer_id order by history.trainer_id),
      '{}'::uuid[]
    )
    into historical_trainer_ids
    from public.teaching_allocations history
    join public.academic_periods history_period
      on history_period.id = history.academic_period_id
    join public.cohorts history_cohort on history_cohort.id = history.cohort_id
    join public.programmes history_programme
      on history_programme.id = history_cohort.programme_id
    join public.units history_unit on history_unit.id = history.unit_id
    join public.trainers trainer on trainer.id = history.trainer_id
    where target_period.code = 'SEP-DEC-26'
      and history_period.code = 'SEP-DEC-29'
      and history.trainer_id is not null
      and trainer.is_active = true
      and trainer.is_timetable_available = true
      and history_programme.department_id = active_department
      and history.session_duration_minutes = pending.session_duration_minutes
      and (
        (history.cohort_id = pending.cohort_id and history.unit_id = pending.unit_id)
        or (
          public.canonical_shared_unit_title(history_unit.name) =
            public.canonical_shared_unit_title(pending.unit_name)
          and coalesce(
            nullif(history.participant_cohort_ids, '{}'::uuid[]),
            array[history.cohort_id]
          ) && coalesce(
            nullif(pending.participant_cohort_ids, '{}'::uuid[]),
            array[pending.cohort_id]
          )
        )
      );

    if cardinality(historical_trainer_ids) = 1 then
      begin
        update public.teaching_allocations allocation
        set
          trainer_id = historical_trainer_ids[1],
          status = 'active',
          notes = left(concat_ws(
            ' ',
            nullif(trim(allocation.notes), ''),
            'Trainer restored from the corrected SEP-DEC-29 history.'
          ), 1500),
          updated_at = now(),
          updated_by = auth.uid()
        where allocation.id = pending.id;

        update public.scheduled_sessions session
        set trainer_id = historical_trainer_ids[1],
            updated_at = now(), updated_by = auth.uid()
        where session.teaching_allocation_id = pending.id
          and session.trainer_id is null
          and session.status not in ('cancelled', 'archived');

        update public.teaching_offerings offering
        set trainer_id = historical_trainer_ids[1], status = 'active',
            updated_at = now(), updated_by = auth.uid()
        where pending.teaching_offering_id is not null
          and offering.id = pending.teaching_offering_id;

        update public.unit_offerings offering
        set allocation_status = 'allocated',
            is_provisionally_reserved = false,
            status = 'active', updated_at = now(), updated_by = auth.uid()
        where offering.academic_period_id = p_academic_period_id
          and (
            offering.confirmed_shared_offering_id = pending.teaching_offering_id
            or (offering.cohort_id = pending.cohort_id and offering.unit_id = pending.unit_id)
          );

        restored_count := restored_count + 1;
      exception
        when others then
          review_count := review_count + 1;
          review_items := review_items || jsonb_build_array(jsonb_build_object(
            'allocationId', pending.id,
            'unitCode', pending.unit_code,
            'unitName', pending.unit_name,
            'cohortCode', pending.cohort_code,
            'candidateCount', 1,
            'reason', left(sqlerrm, 300)
          ));
      end;
    else
      review_count := review_count + 1;
      review_items := review_items || jsonb_build_array(jsonb_build_object(
        'allocationId', pending.id,
        'unitCode', pending.unit_code,
        'unitName', pending.unit_name,
        'cohortCode', pending.cohort_code,
        'candidateCount', cardinality(historical_trainer_ids),
        'reason', case
          when cardinality(historical_trainer_ids) = 0
            then 'No assigned equivalent or reliable previous trainer was found'
          else 'More than one previous trainer was found'
        end
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'academicPeriodId', p_academic_period_id,
    'mergedCount', merged_count,
    'restoredCount', restored_count,
    'reviewCount', review_count,
    'reviewItems', review_items
  );
end;
$$;

revoke all
on function public.reconcile_previous_trainer_assignments(uuid)
from public;

grant execute
on function public.reconcile_previous_trainer_assignments(uuid)
to authenticated;

comment on function public.reconcile_previous_trainer_assignments(uuid) is
  'Rejoins a separated trainer-pending equivalent to its one assigned shared class, or restores one unambiguous corrected-period trainer; ambiguous records remain unchanged.';
