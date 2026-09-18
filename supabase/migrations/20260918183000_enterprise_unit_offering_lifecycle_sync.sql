-- ============================================================================
-- Migration: Enterprise Unit Offering Lifecycle Synchronization & Clash Clearing
--
-- 0. Deduplication & Partial Unique Index Guard:
--    - Deduplicates any duplicate allocations in public.teaching_allocations
--      for (academic_period_id, cohort_id, unit_id) by archiving older duplicates.
--    - Standardizes the partial unique index:
--      teaching_allocations_period_cohort_unit_unique_idx ON public.teaching_allocations
--      (academic_period_id, cohort_id, unit_id) WHERE status IN ('draft', 'active', 'suspended').
--
-- 1. Fix validate_teaching_allocation():
--    - When an allocation is disabled (not is_timetable_enabled) or set to
--      'suspended', 'completed', or 'archived', bypass all
--      checks and return NEW immediately.
--    - When active, allow cross-stage units if an approved unit offering
--      exists for (academic_period_id, cohort_id, unit_id).
--
-- 2. Update set_unit_offering_approval():
--    - When dropping (p_approve = false):
--      * Decouple shared teaching allocations and sessions cleanly:
--        remove the dropped cohort from participant_cohort_ids and
--        teaching_offering_participants.
--      * NEVER mutate cohort_id on an existing allocation record to another cohort,
--        eliminating duplicate key collisions on teaching_allocations_period_cohort_unit_unique_idx.
--      * If partner cohorts were sharing the unit, ensure each partner cohort has its own
--        independent active/draft allocation.
--      * Suspend the dropped cohort's allocation and unlock/cancel any solo scheduled sessions.
--    - When approving (p_approve = true):
--      * Re-enable existing allocations matching (academic_period_id, cohort_id, unit_id).
--      * Create an unassigned draft allocation only when none exists, ensuring it
--        is immediately ready for timetabling without unique constraint collisions.
--
-- 3. Update add_special_unit_offering():
--    - Sets approval_status = 'approved', approved_by, approved_at.
--    - Creates or reactivates an unassigned draft teaching allocation safely.
--
-- 4. Update save_generated_timetable_draft():
--    - Purges orphaned or suspended sessions for the department before
--      persisting newly generated sessions.
--
-- 5. Data Cleanup:
--    - Clears DNDT-SEP-2026 from any Research participants, allocations, and sessions.
--    - Reconciles Agricultural Production for CHN MAY 25 / CND MAY 25 without clashes.
-- ============================================================================

-- 0. Deduplication & Partial Unique Index Guard
with ranked_allocations as (
  select id,
         row_number() over (
           partition by academic_period_id, cohort_id, unit_id
           order by
             case status
               when 'active' then 1
               when 'draft' then 2
               when 'suspended' then 3
               else 4
             end,
             updated_at desc,
             created_at desc
         ) as rn
  from public.teaching_allocations
  where status in ('draft', 'active', 'suspended')
)
update public.teaching_allocations
set status = 'archived',
    is_timetable_enabled = false,
    notes = left(concat_ws(' | ', nullif(trim(notes), ''), 'Archived duplicate allocation during enterprise lifecycle sync'), 1500),
    updated_at = now()
where id in (
  select id from ranked_allocations where rn > 1
);

drop index if exists public.teaching_allocations_period_cohort_unit_unique_idx;

create unique index teaching_allocations_period_cohort_unit_unique_idx
on public.teaching_allocations (
  academic_period_id,
  cohort_id,
  unit_id
)
where status in ('draft', 'active', 'suspended');

-- 1. Fix validate_teaching_allocation()
create or replace function public.validate_teaching_allocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
  selected_trainer public.trainers%rowtype;
  selected_room public.rooms%rowtype;
  has_audited_legacy_offering boolean := false;
begin
  -- Completed, suspended, or disabled allocations cannot
  -- remain enabled for timetable generation, and do not need stage/resource checks.
  if new.status in ('suspended', 'completed', 'archived')
     or not coalesce(new.is_timetable_enabled, false) then
    new.is_timetable_enabled := false;
    return new;
  end if;

  select * into selected_period
  from public.academic_periods
  where id = new.academic_period_id;

  if selected_period.id is null then
    raise exception using errcode = 'P0002',
      message = 'Academic Period not found';
  end if;

  select * into selected_cohort
  from public.cohorts
  where id = new.cohort_id;

  if selected_cohort.id is null then
    raise exception using errcode = 'P0002', message = 'Cohort not found';
  end if;

  select * into selected_unit
  from public.units
  where id = new.unit_id;

  if selected_unit.id is null then
    raise exception using errcode = 'P0002', message = 'Unit not found';
  end if;

  if new.trainer_id is not null then
    select * into selected_trainer
    from public.trainers
    where id = new.trainer_id;

    if selected_trainer.id is null then
      raise exception using errcode = 'P0002', message = 'Trainer not found';
    end if;
  end if;

  if new.preferred_room_id is not null then
    select * into selected_room
    from public.rooms
    where id = new.preferred_room_id;

    if selected_room.id is null then
      raise exception using errcode = 'P0002',
        message = 'Preferred room not found';
    end if;
  end if;

  if selected_unit.programme_id <> selected_cohort.programme_id then
    raise exception using errcode = 'P0001',
      message = 'The selected unit does not belong to the cohort programme';
  end if;

  if selected_unit.academic_period_number is distinct from
     selected_cohort.current_academic_period_number then
    select exists (
      select 1
      from public.unit_offerings offering
      where offering.academic_period_id = new.academic_period_id
        and offering.cohort_id = new.cohort_id
        and offering.unit_id = new.unit_id
        and (
          (offering.approval_status = 'approved' and offering.selection_state = 'included' and offering.is_timetable_enabled = true)
          or (offering.origin in ('legacy', 'special') and nullif(trim(offering.exception_reason), '') is not null)
        )
    ) into has_audited_legacy_offering;

    if not has_audited_legacy_offering then
      raise exception using errcode = 'P0001',
        message = 'The unit does not belong to the cohort current programme period';
    end if;
  end if;

  if new.is_timetable_enabled
     and selected_period.status not in ('planned', 'active') then
    raise exception using errcode = 'P0001',
      message = 'The selected Academic Period is not open for timetable allocation';
  end if;

  if new.is_timetable_enabled
     and selected_cohort.status not in ('planned', 'active') then
    raise exception using errcode = 'P0001',
      message = 'The selected cohort is not available for timetable allocation';
  end if;

  if new.is_timetable_enabled and not selected_cohort.is_timetable_available then
    raise exception using errcode = 'P0001',
      message = 'The selected cohort is not enabled for timetabling';
  end if;

  if new.is_timetable_enabled and (
    not selected_unit.is_active or not selected_unit.is_timetable_available
  ) then
    raise exception using errcode = 'P0001',
      message = 'The selected unit is not available for timetabling';
  end if;

  if new.is_timetable_enabled and new.trainer_id is not null and (
    not selected_trainer.is_active or not selected_trainer.is_timetable_available
  ) then
    raise exception using errcode = 'P0001',
      message = 'The selected trainer is not available for timetabling';
  end if;

  if new.is_timetable_enabled and new.preferred_room_id is not null and (
    not selected_room.is_active or not selected_room.is_timetable_available
  ) then
    raise exception using errcode = 'P0001',
      message = 'The preferred room is not available for timetabling';
  end if;

  if new.preferred_room_id is not null
     and selected_cohort.actual_size > 0
     and selected_room.capacity < selected_cohort.actual_size then
    raise exception using errcode = 'P0001',
      message = 'The preferred room capacity is below the cohort enrolment';
  end if;

  return new;
end;
$$;

comment on function public.validate_teaching_allocation() is
  'Validates timetable allocations, permitting approved or audited cross-stage offerings and gracefully bypassing deactivating allocations.';

-- 2. Update set_unit_offering_approval()
create or replace function public.set_unit_offering_approval(
  p_offering_ids uuid[],
  p_approve      boolean,
  p_reason       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  changed           integer := 0;
  clean_reason      text  := coalesce(
    nullif(trim(p_reason), ''),
    case when p_approve
      then null
      else 'Dropped from cohort teaching plan for this academic period'
    end
  );
  blocked_ids       uuid[];
  r record;
  rem_cohort uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if coalesce(cardinality(p_offering_ids), 0) = 0 then
    raise exception 'Select at least one Unit on Offer';
  end if;

  if not p_approve and nullif(trim(p_reason), '') is null then
    raise exception 'Provide a reason when withdrawing an offering';
  end if;

  -- Identify offerings outside manageable departments
  select array_agg(o.id)
  into   blocked_ids
  from   public.unit_offerings o
  join   public.cohorts         c  on c.id  = o.cohort_id
  join   public.programmes      pr on pr.id = c.programme_id
  where  o.id = any(p_offering_ids)
    and  not (
      pr.department_id = active_department
      or public.current_user_can_manage_department(pr.department_id)
    );

  -- 1. Update unblocked offerings
  update public.unit_offerings offering set
    approval_status      = case when p_approve
                             then 'approved'::public.unit_offering_approval_status
                             else 'withdrawn'::public.unit_offering_approval_status end,
    selection_state      = case when p_approve
                             then 'included'::public.unit_offering_selection_state
                             else 'excluded'::public.unit_offering_selection_state end,
    status               = case when p_approve
                             then 'draft'::public.unit_offering_status
                             else 'cancelled'::public.unit_offering_status end,
    is_timetable_enabled = p_approve
                           and offering.offering_type not in ('attachment', 'clinical_rotation', 'examination'),
    approved_by          = case when p_approve then auth.uid() else null end,
    approved_at          = case when p_approve then now()       else null end,
    withdrawn_by         = case when p_approve then null else auth.uid() end,
    withdrawn_at         = case when p_approve then null else now()       end,
    withdrawal_reason    = case when p_approve then null else clean_reason end,
    exception_reason     = case
                             when not p_approve
                               then coalesce(clean_reason, offering.exception_reason,
                                    'Dropped from cohort teaching plan for this academic period')
                             when p_approve and offering.origin = 'curriculum'
                               then offering.exception_reason
                             when p_approve and offering.origin <> 'curriculum'
                               then coalesce(offering.exception_reason, 'Approved cohort unit offering')
                             else offering.exception_reason
                           end,
    manually_reviewed    = true,
    reviewed_by          = auth.uid(),
    reviewed_at          = now(),
    updated_by           = auth.uid(),
    updated_at           = now()
  from public.cohorts      cohort
  join public.programmes   programme on programme.id = cohort.programme_id
  where offering.id = any(p_offering_ids)
    and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
    and offering.cohort_id = cohort.id
    and (
      programme.department_id = active_department
      or public.current_user_can_manage_department(programme.department_id)
    );

  get diagnostics changed = row_count;

  if p_approve then
    -- A. Re-link and re-enable existing allocations (draft, suspended, or archived)
    update public.teaching_allocations allocation
    set    source_unit_offering_id = offering.id,
           is_timetable_enabled    = (offering.offering_type not in ('attachment', 'clinical_rotation', 'examination')),
           status                  = case when allocation.status in ('suspended', 'archived') then 'draft' else allocation.status end,
           updated_by              = auth.uid(),
           updated_at              = now()
    from   public.unit_offerings offering
    where  offering.id = any(p_offering_ids)
      and  not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
      and  allocation.id = (
             select a2.id from public.teaching_allocations a2
             where a2.academic_period_id = offering.academic_period_id
               and a2.cohort_id          = offering.cohort_id
               and a2.unit_id            = offering.unit_id
             order by case a2.status
                        when 'active' then 1
                        when 'draft' then 2
                        when 'suspended' then 3
                        else 4
                      end,
                      a2.updated_at desc
             limit 1
           );

    -- B. For approved offerings that still have NO teaching allocation at all, insert an unassigned draft
    insert into public.teaching_allocations (
      academic_period_id,
      cohort_id,
      unit_id,
      trainer_id,
      source_unit_offering_id,
      delivery_mode,
      weekly_sessions,
      session_duration_minutes,
      status,
      is_timetable_enabled,
      participant_cohort_ids,
      combined_cohort_size,
      notes,
      created_by,
      updated_by
    )
    select distinct on (offering.academic_period_id, offering.cohort_id, offering.unit_id)
      offering.academic_period_id,
      offering.cohort_id,
      offering.unit_id,
      null,
      offering.id,
      case when offering.offering_type = 'practical'
        then 'practical'::public.teaching_delivery_mode
        else 'theory'::public.teaching_delivery_mode end,
      coalesce(offering.weekly_sessions, unit.weekly_sessions, 1),
      coalesce(offering.session_duration_minutes, 120),
      'draft',
      true,
      array[offering.cohort_id],
      coalesce(cohort.actual_size, 0),
      'Approved cohort unit offering ready for timetabling',
      auth.uid(),
      auth.uid()
    from public.unit_offerings offering
    join public.cohorts cohort on cohort.id = offering.cohort_id
    join public.units unit on unit.id = offering.unit_id
    where offering.id = any(p_offering_ids)
      and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
      and offering.offering_type not in ('attachment', 'clinical_rotation', 'examination')
      and not exists (
        select 1 from public.teaching_allocations alloc
        where alloc.academic_period_id = offering.academic_period_id
          and alloc.cohort_id = offering.cohort_id
          and alloc.unit_id = offering.unit_id
      )
    on conflict (academic_period_id, cohort_id, unit_id) where status in ('draft', 'active', 'suspended')
    do update set
      source_unit_offering_id = excluded.source_unit_offering_id,
      is_timetable_enabled = true,
      status = 'draft',
      updated_by = auth.uid(),
      updated_at = now();

  else
    -- When withdrawing / dropping:
    for r in
      select o.id as offering_id, o.cohort_id, o.unit_id, o.academic_period_id
      from public.unit_offerings o
      where o.id = any(p_offering_ids)
        and not (o.id = any(coalesce(blocked_ids, '{}'::uuid[])))
    loop
      -- 1. Remove from teaching_offering_participants
      delete from public.teaching_offering_participants
      where unit_offering_id = r.offering_id
         or (
           cohort_id = r.cohort_id
           and unit_id = r.unit_id
           and teaching_offering_id in (
             select o.id from public.teaching_offerings o where o.academic_period_id = r.academic_period_id
           )
         );

      -- 2. Handle partner cohorts that were co-enrolled/sharing this unit
      for rem_cohort in
        select distinct unnest(array_remove(a.participant_cohort_ids, r.cohort_id))
        from public.teaching_allocations a
        where a.academic_period_id = r.academic_period_id
          and a.unit_id = r.unit_id
          and r.cohort_id = any(a.participant_cohort_ids)
          and cardinality(array_remove(a.participant_cohort_ids, r.cohort_id)) > 0
      loop
        -- If rem_cohort has an existing allocation, ensure it remains active/draft and clean its participants
        update public.teaching_allocations
        set is_timetable_enabled = true,
            status = case when status in ('suspended', 'archived') then 'draft' else status end,
            participant_cohort_ids = array_remove(participant_cohort_ids, r.cohort_id),
            combined_cohort_size = (
              select coalesce(sum(c.actual_size), 0)
              from public.cohorts c
              where c.id = any(array_remove(teaching_allocations.participant_cohort_ids, r.cohort_id))
            ),
            updated_by = auth.uid(),
            updated_at = now()
        where academic_period_id = r.academic_period_id
          and cohort_id = rem_cohort
          and unit_id = r.unit_id;

        -- If rem_cohort has NO allocation of its own, create an unassigned draft for rem_cohort
        if not found then
          insert into public.teaching_allocations (
            academic_period_id,
            cohort_id,
            unit_id,
            trainer_id,
            source_unit_offering_id,
            delivery_mode,
            weekly_sessions,
            session_duration_minutes,
            status,
            is_timetable_enabled,
            participant_cohort_ids,
            combined_cohort_size,
            notes,
            created_by,
            updated_by
          )
          select
            r.academic_period_id,
            rem_cohort,
            r.unit_id,
            null,
            (select o.id from public.unit_offerings o where o.academic_period_id = r.academic_period_id and o.cohort_id = rem_cohort and o.unit_id = r.unit_id limit 1),
            'theory'::public.teaching_delivery_mode,
            coalesce(u.weekly_sessions, 1),
            120,
            'draft',
            true,
            array[rem_cohort],
            coalesce(c.actual_size, 0),
            'Allocation maintained after partner cohort withdrew unit',
            auth.uid(),
            auth.uid()
          from public.units u
          join public.cohorts c on c.id = rem_cohort
          where u.id = r.unit_id
          on conflict (academic_period_id, cohort_id, unit_id) where status in ('draft', 'active', 'suspended')
          do update set
            is_timetable_enabled = true,
            status = 'draft',
            updated_by = auth.uid(),
            updated_at = now();
        end if;
      end loop;

      -- 3. Suspend r.cohort_id's allocation (NEVER update cohort_id to another cohort!)
      update public.teaching_allocations allocation
      set is_timetable_enabled = false,
          status = 'suspended',
          participant_cohort_ids = array_remove(participant_cohort_ids, r.cohort_id),
          updated_by = auth.uid(),
          updated_at = now()
      where (allocation.source_unit_offering_id = r.offering_id
             or (allocation.academic_period_id = r.academic_period_id and allocation.cohort_id = r.cohort_id and allocation.unit_id = r.unit_id));

      -- 4. Clean participant_cohort_ids across all allocations for this unit where r.cohort_id participated
      update public.teaching_allocations allocation
      set participant_cohort_ids = array_remove(participant_cohort_ids, r.cohort_id),
          combined_cohort_size = (
            select coalesce(sum(c.actual_size), 0)
            from public.cohorts c
            where c.id = any(array_remove(allocation.participant_cohort_ids, r.cohort_id))
          ),
          updated_by = auth.uid(),
          updated_at = now()
      where allocation.academic_period_id = r.academic_period_id
        and allocation.unit_id = r.unit_id
        and r.cohort_id = any(allocation.participant_cohort_ids);

      -- 5. Handle scheduled sessions:
      -- A. Shared sessions with other cohorts: remove this cohort from participant_cohort_ids
      update public.scheduled_sessions session
      set participant_cohort_ids = array_remove(participant_cohort_ids, r.cohort_id),
          cohort_id = case when session.cohort_id = r.cohort_id
            then (select unnest(array_remove(session.participant_cohort_ids, r.cohort_id)) limit 1)
            else session.cohort_id end,
          combined_cohort_size = (
            select coalesce(sum(c.actual_size), 0)
            from public.cohorts c
            where c.id = any(array_remove(session.participant_cohort_ids, r.cohort_id))
          ),
          conflict_state = 'clear',
          updated_by = auth.uid(),
          updated_at = now()
      where session.academic_period_id = r.academic_period_id
        and (session.unit_id = r.unit_id or session.teaching_allocation_id in (
          select id from public.teaching_allocations where unit_id = r.unit_id and academic_period_id = r.academic_period_id
        ))
        and r.cohort_id = any(session.participant_cohort_ids)
        and cardinality(array_remove(session.participant_cohort_ids, r.cohort_id)) > 0;

      -- B. Solo sessions for this dropped cohort/offering: cancel and unlock
      update public.scheduled_sessions session
      set status = 'cancelled',
          conflict_state = 'clear',
          is_locked = false,
          notes = left(concat_ws(' ', nullif(trim(session.notes), ''), 'Cancelled because unit offering was dropped by HOD.'), 1000),
          updated_by = auth.uid(),
          updated_at = now()
      where session.academic_period_id = r.academic_period_id
        and (
          session.teaching_allocation_id in (
            select id from public.teaching_allocations
            where source_unit_offering_id = r.offering_id
               or (academic_period_id = r.academic_period_id and cohort_id = r.cohort_id and unit_id = r.unit_id)
          )
          or (session.cohort_id = r.cohort_id and session.unit_id = r.unit_id)
          or (session.cohort_id = r.cohort_id and (
            session.participant_cohort_ids is null or session.participant_cohort_ids = array[r.cohort_id]
          ))
        )
        and session.status not in ('cancelled', 'archived');
    end loop;
  end if;

  return jsonb_build_object(
    'changed',      changed,
    'blocked',      coalesce(cardinality(blocked_ids), 0),
    'blocked_ids',  coalesce(to_jsonb(blocked_ids), '[]'::jsonb),
    'message',      case
                      when coalesce(cardinality(blocked_ids), 0) = 0
                        then null
                      when changed = 0
                        then 'Offerings could not be updated because they belong to departments you cannot manage.'
                      else format(
                        '%s offering(s) updated. %s offering(s) were skipped because they belong to other departments.',
                        changed,
                        cardinality(blocked_ids)
                      )
                    end
  );
end;
$$;

revoke all on function public.set_unit_offering_approval(uuid[], boolean, text) from public;
grant  execute on function public.set_unit_offering_approval(uuid[], boolean, text) to authenticated;

-- 3. Update add_special_unit_offering()
create or replace function public.add_special_unit_offering(
  selected_academic_period_id uuid,
  selected_cohort_id uuid,
  selected_unit_id uuid,
  selected_reason text
)
returns public.unit_offerings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
  result public.unit_offerings%rowtype;
begin
  if not (
    select public.current_user_has_role(
      array['hod', 'system_admin']::public.app_role[]
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'You are not authorized to add a special Unit on Offer';
  end if;

  if selected_reason is null
     or char_length(trim(selected_reason)) < 3 then
    raise exception using
      errcode = '23514',
      message = 'A special Unit on Offer requires a reason';
  end if;

  select * into selected_cohort
  from public.cohorts
  where id = selected_cohort_id;

  if selected_cohort.id is null then
    raise exception using errcode = 'P0002', message = 'Cohort not found';
  end if;

  select * into selected_unit
  from public.units
  where id = selected_unit_id;

  if selected_unit.id is null then
    raise exception using errcode = 'P0002', message = 'Unit not found';
  end if;

  if selected_unit.programme_id <> selected_cohort.programme_id then
    raise exception using
      errcode = '23514',
      message = 'A special unit must still belong to the cohort programme';
  end if;

  insert into public.unit_offerings (
    academic_period_id,
    cohort_id,
    unit_id,
    offering_type,
    status,
    approval_status,
    approved_by,
    approved_at,
    withdrawn_by,
    withdrawn_at,
    withdrawal_reason,
    is_timetable_enabled,
    weekly_sessions,
    session_duration_minutes,
    source,
    origin,
    selection_state,
    recommended_stage_number,
    exception_reason,
    manually_reviewed,
    reviewed_by,
    reviewed_at,
    created_by,
    updated_by
  )
  values (
    selected_academic_period_id,
    selected_cohort_id,
    selected_unit_id,
    case
      when coalesce(selected_unit.practical_hours, 0) > coalesce(selected_unit.theory_hours, 0)
        then 'practical'::public.unit_offering_type
      else 'classroom'::public.unit_offering_type
    end,
    'draft'::public.unit_offering_status,
    'approved'::public.unit_offering_approval_status,
    auth.uid(),
    now(),
    null,
    null,
    null,
    true,
    coalesce(selected_unit.weekly_sessions, 1),
    120,
    'manual_special_exception',
    'special'::public.unit_offering_origin,
    'included'::public.unit_offering_selection_state,
    selected_unit.academic_period_number,
    trim(selected_reason),
    true,
    auth.uid(),
    now(),
    auth.uid(),
    auth.uid()
  )
  on conflict (
    academic_period_id,
    cohort_id,
    unit_id
  )
  do update
  set
    approval_status = 'approved'::public.unit_offering_approval_status,
    approved_by = auth.uid(),
    approved_at = now(),
    withdrawn_by = null,
    withdrawn_at = null,
    withdrawal_reason = null,
    selection_state = 'included',
    status = 'draft',
    is_timetable_enabled = true,
    exception_reason = trim(selected_reason),
    manually_reviewed = true,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_by = auth.uid(),
    updated_at = now()
  returning *
  into result;

  -- Ensure teaching allocation exists and is enabled
  update public.teaching_allocations
  set source_unit_offering_id = result.id,
      is_timetable_enabled = true,
      status = 'draft',
      updated_by = auth.uid(),
      updated_at = now()
  where academic_period_id = selected_academic_period_id
    and cohort_id = selected_cohort_id
    and unit_id = selected_unit_id;

  if not found then
    insert into public.teaching_allocations (
      academic_period_id,
      cohort_id,
      unit_id,
      trainer_id,
      source_unit_offering_id,
      delivery_mode,
      weekly_sessions,
      session_duration_minutes,
      status,
      is_timetable_enabled,
      participant_cohort_ids,
      combined_cohort_size,
      notes,
      created_by,
      updated_by
    ) values (
      selected_academic_period_id,
      selected_cohort_id,
      selected_unit_id,
      null,
      result.id,
      case when selected_unit.practical_hours > selected_unit.theory_hours
        then 'practical'::public.teaching_delivery_mode
        else 'theory'::public.teaching_delivery_mode end,
      coalesce(selected_unit.weekly_sessions, 1),
      120,
      'draft',
      true,
      array[selected_cohort_id],
      coalesce(selected_cohort.actual_size, 0),
      'Special unit offering added by HOD',
      auth.uid(),
      auth.uid()
    )
    on conflict (academic_period_id, cohort_id, unit_id) where status in ('draft', 'active', 'suspended')
    do update set
      source_unit_offering_id = excluded.source_unit_offering_id,
      is_timetable_enabled = true,
      status = 'draft',
      updated_by = auth.uid(),
      updated_at = now();
  end if;

  return result;
end;
$$;

revoke all on function public.add_special_unit_offering(uuid, uuid, uuid, text) from public;
grant  execute on function public.add_special_unit_offering(uuid, uuid, uuid, text) to authenticated;

-- 4. Update save_generated_timetable_draft()
create or replace function public.save_generated_timetable_draft(
  target_academic_period_id uuid,
  generated_sessions jsonb,
  generation_summary jsonb default '{}'::jsonb
)
returns table (
  generation_run_id uuid,
  saved_session_count integer,
  locked_session_count integer,
  unscheduled_session_count integer
)
language plpgsql security definer set search_path = '' as $$
declare
  session_item jsonb;
  run_id uuid;
  active_department uuid := public.current_user_primary_department_id();
  saved_total integer := 0;
  locked_total integer := 0;
  unscheduled_total integer :=
    coalesce((generation_summary ->> 'unscheduledSessionCount')::integer, 0);
  requested_total integer :=
    coalesce((generation_summary ->> 'requestedSessionCount')::integer, 0);
  conflict_total integer :=
    coalesce((generation_summary ->> 'conflictCount')::integer, 0);
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before generating.';
  end if;
  if jsonb_typeof(generated_sessions) <> 'array' then
    raise exception using errcode = '22023',
      message = 'Generated sessions must be supplied as a JSON array.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'timetable-generation:' || active_department::text || ':'
      || target_academic_period_id::text, 0
  ));

  -- Delete any orphaned/suspended sessions for this department so they never persist as ghost clashes
  delete from public.scheduled_sessions session
  using public.teaching_allocations allocation, public.cohorts cohort, public.programmes programme
  where session.teaching_allocation_id = allocation.id
    and session.cohort_id = cohort.id
    and cohort.programme_id = programme.id
    and session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and (allocation.status in ('suspended', 'archived') or not allocation.is_timetable_enabled or session.status = 'cancelled');

  select count(*) into locked_total
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and (session.is_locked or session.status = 'locked');

  delete from public.scheduled_sessions session
  using public.cohorts cohort, public.programmes programme
  where session.cohort_id = cohort.id
    and cohort.programme_id = programme.id
    and session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and session.is_locked = false
    and session.status in ('draft', 'confirmed', 'cancelled');

  for session_item in select value from jsonb_array_elements(generated_sessions)
  loop
    if coalesce((session_item ->> 'isLocked')::boolean, false) then
      continue;
    end if;

    if not exists (
      select 1
      from public.teaching_allocations allocation
      join public.cohorts cohort on cohort.id = allocation.cohort_id
      join public.programmes programme on programme.id = cohort.programme_id
      where allocation.id =
          (session_item ->> 'teachingAllocationId')::uuid
        and allocation.academic_period_id = target_academic_period_id
        and programme.department_id = active_department
    ) then
      raise exception using errcode = '42501',
        message = 'A generated session belongs to another department.';
    end if;

    insert into public.scheduled_sessions (
      academic_period_id, teaching_allocation_id, cohort_id, unit_id,
      trainer_id, working_day_id, start_time_slot_id, end_time_slot_id,
      room_id, session_number, delivery_mode, status, source,
      conflict_state, is_locked, notes, created_by, updated_by
    ) values (
      target_academic_period_id,
      (session_item ->> 'teachingAllocationId')::uuid,
      (session_item ->> 'cohortId')::uuid,
      (session_item ->> 'unitId')::uuid,
      (session_item ->> 'trainerId')::uuid,
      (session_item ->> 'workingDayId')::uuid,
      (session_item ->> 'startTimeSlotId')::uuid,
      (session_item ->> 'endTimeSlotId')::uuid,
      (session_item ->> 'roomId')::uuid,
      (session_item ->> 'sessionNumber')::smallint,
      (session_item ->> 'deliveryMode')::public.teaching_delivery_mode,
      'draft'::public.scheduled_session_status,
      'generator'::public.scheduled_session_source,
      'clear'::public.scheduled_session_conflict_state,
      false,
      'Generated by the institutional timetabler.',
      auth.uid(),
      auth.uid()
    );
    saved_total := saved_total + 1;
  end loop;

  insert into public.timetable_generation_runs (
    academic_period_id, department_id, requested_session_count,
    scheduled_session_count, unscheduled_session_count, conflict_count,
    generation_summary, created_by
  ) values (
    target_academic_period_id, active_department, requested_total,
    saved_total + locked_total, unscheduled_total, conflict_total,
    generation_summary, auth.uid()
  ) returning id into run_id;

  return query select run_id, saved_total, locked_total, unscheduled_total;
end;
$$;

revoke all on function public.save_generated_timetable_draft(uuid, jsonb, jsonb) from public;
grant execute on function public.save_generated_timetable_draft(uuid, jsonb, jsonb) to authenticated;

-- 5. Immediate Data Cleanup: Clear DNDT-SEP-2026 from Research & Reconcile Agricultural Production
do $$
declare
  dndt_cohort_id uuid;
  research_unit_ids uuid[];
  chn_cohort_id uuid;
  agric_unit_ids uuid[];
begin
  -- A. Clear DNDT-SEP-2026 from Research ghost participants/sessions
  select id into dndt_cohort_id
  from public.cohorts
  where code ilike '%DNDT%' or name ilike '%DNDT%'
  order by created_at desc limit 1;

  select array_agg(id) into research_unit_ids
  from public.units
  where name ilike '%research%' or code ilike '%research%';

  if dndt_cohort_id is not null and research_unit_ids is not null then
    -- Remove DNDT from participant_cohort_ids in shared scheduled_sessions
    update public.scheduled_sessions session
    set participant_cohort_ids = array_remove(participant_cohort_ids, dndt_cohort_id),
        conflict_state = 'clear',
        updated_at = now()
    where (unit_id = any(research_unit_ids) or session.teaching_allocation_id in (
      select id from public.teaching_allocations where unit_id = any(research_unit_ids)
    ))
      and dndt_cohort_id = any(participant_cohort_ids)
      and cardinality(array_remove(participant_cohort_ids, dndt_cohort_id)) > 0;

    -- Cancel any solo session for DNDT on Research
    update public.scheduled_sessions session
    set status = 'cancelled',
        conflict_state = 'clear',
        is_locked = false,
        notes = left(concat_ws(' ', nullif(trim(session.notes), ''), 'Cancelled because unit was dropped.'), 1000),
        updated_at = now()
    where (unit_id = any(research_unit_ids) or session.teaching_allocation_id in (
      select id from public.teaching_allocations where unit_id = any(research_unit_ids)
    ))
      and (cohort_id = dndt_cohort_id or participant_cohort_ids = array[dndt_cohort_id])
      and session.status not in ('cancelled', 'archived');

    -- Remove DNDT from teaching_allocations participant_cohort_ids
    update public.teaching_allocations allocation
    set participant_cohort_ids = array_remove(participant_cohort_ids, dndt_cohort_id),
        updated_at = now()
    where unit_id = any(research_unit_ids)
      and dndt_cohort_id = any(participant_cohort_ids)
      and cardinality(array_remove(participant_cohort_ids, dndt_cohort_id)) > 0;

    -- Suspend any solo allocation for DNDT on Research
    update public.teaching_allocations allocation
    set is_timetable_enabled = false,
        status = 'suspended',
        updated_at = now()
    where unit_id = any(research_unit_ids)
      and cohort_id = dndt_cohort_id
      and (participant_cohort_ids is null or participant_cohort_ids = array[dndt_cohort_id]);

    -- Delete from teaching_offering_participants
    delete from public.teaching_offering_participants
    where cohort_id = dndt_cohort_id and unit_id = any(research_unit_ids);
  end if;

  -- B. Reconcile Agricultural Production for CHN MAY 25
  select id into chn_cohort_id
  from public.cohorts
  where (code ilike '%CHN%MAY%25%' or name ilike '%CHN%MAY%25%')
  order by created_at desc limit 1;

  select array_agg(id) into agric_unit_ids
  from public.units
  where name ilike '%Agricultural Production%' or code in ('CHN 2309', 'CND 2306', 'DND 3205');

  if chn_cohort_id is not null and agric_unit_ids is not null then
    if exists (
      select 1 from public.unit_offerings
      where cohort_id = chn_cohort_id
        and unit_id = any(agric_unit_ids)
        and approval_status = 'withdrawn'
    ) then
      update public.teaching_allocations
      set participant_cohort_ids = array_remove(participant_cohort_ids, chn_cohort_id),
          updated_at = now()
      where unit_id = any(agric_unit_ids)
        and chn_cohort_id = any(participant_cohort_ids)
        and cardinality(array_remove(participant_cohort_ids, chn_cohort_id)) > 0;

      update public.teaching_allocations
      set is_timetable_enabled = false,
          status = 'suspended',
          updated_at = now()
      where unit_id = any(agric_unit_ids)
        and cohort_id = chn_cohort_id;

      update public.scheduled_sessions
      set participant_cohort_ids = array_remove(participant_cohort_ids, chn_cohort_id),
          conflict_state = 'clear',
          updated_at = now()
      where (unit_id = any(agric_unit_ids) or teaching_allocation_id in (
        select id from public.teaching_allocations where unit_id = any(agric_unit_ids)
      ))
        and chn_cohort_id = any(participant_cohort_ids)
        and cardinality(array_remove(participant_cohort_ids, chn_cohort_id)) > 0;

      update public.scheduled_sessions
      set status = 'cancelled',
          conflict_state = 'clear',
          is_locked = false,
          updated_at = now()
      where (unit_id = any(agric_unit_ids) or teaching_allocation_id in (
        select id from public.teaching_allocations where unit_id = any(agric_unit_ids)
      ))
        and (cohort_id = chn_cohort_id or participant_cohort_ids = array[chn_cohort_id])
        and status not in ('cancelled', 'archived');
    end if;
  end if;
end $$;
