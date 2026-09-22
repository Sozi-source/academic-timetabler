-- ============================================================================
-- Migration: Fix Unit Offering Withdrawal Exception Reason Check Constraint
--
-- Problem:
--   When withdrawing/dropping an offering via set_unit_offering_approval,
--   selection_state is updated to 'excluded', while withdrawal_reason is set to
--   p_reason. However, exception_reason was left null, which directly violated
--   the check constraint "unit_offerings_exception_reason_required_check"
--   ((origin = 'curriculum' AND selection_state = 'included') OR exception_reason is not null).
--
-- Fix:
--   1. Backfill exception_reason from withdrawal_reason for any excluded offerings.
--   2. Update the check constraint to recognize withdrawal_reason as well as exception_reason.
--   3. Update validate_unit_offering trigger to auto-populate exception_reason when excluded.
--   4. Update set_unit_offering_approval RPC to populate both withdrawal_reason and exception_reason.
-- ============================================================================

-- 1. Backfill existing excluded rows that lack exception_reason
update public.unit_offerings
set exception_reason = coalesce(
  nullif(trim(withdrawal_reason), ''),
  'Excluded from active cohort teaching plan'
)
where exception_reason is null
  and (
    selection_state = 'excluded'
    or origin in ('special', 'legacy', 'import')
  );

-- 2. Relax the check constraint to accept either exception_reason OR withdrawal_reason when excluded
alter table public.unit_offerings
  drop constraint if exists unit_offerings_exception_reason_required_check;

alter table public.unit_offerings
  add constraint unit_offerings_exception_reason_required_check
  check (
    (
      origin = 'curriculum'
      and selection_state = 'included'
    )
    or exception_reason is not null
    or withdrawal_reason is not null
  );

-- 3. Update validate_unit_offering() to automatically guarantee exception_reason on exclusion
create or replace function public.validate_unit_offering()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
begin
  select *
  into selected_period
  from public.academic_periods
  where id = new.academic_period_id;

  if selected_period.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Academic Period not found';
  end if;

  select *
  into selected_cohort
  from public.cohorts
  where id = new.cohort_id;

  if selected_cohort.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Cohort not found';
  end if;

  select *
  into selected_unit
  from public.units
  where id = new.unit_id;

  if selected_unit.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Unit not found';
  end if;

  if selected_cohort.programme_id
      <> selected_unit.programme_id then
    raise exception using
      errcode = '23514',
      message =
        'A Unit on Offer must belong to the same programme as its cohort';
  end if;

  if new.origin = 'curriculum' then
    if selected_unit.academic_period_number
        <> selected_cohort.current_academic_period_number then
      raise exception using
        errcode = '23514',
        message =
          'A curriculum recommendation must belong to the cohort current academic stage';
    end if;

    new.recommended_stage_number =
      selected_cohort.current_academic_period_number;
  end if;

  if new.origin = 'special' then
    if new.exception_reason is null
       or char_length(trim(new.exception_reason)) < 3 then
      raise exception using
        errcode = '23514',
        message =
          'A special Unit on Offer requires an exception reason';
    end if;
  end if;

  if new.selection_state = 'excluded' then
    new.is_timetable_enabled = false;

    if new.status <> 'cancelled' then
      new.status =
        'cancelled'
          ::public.unit_offering_status;
    end if;

    if new.exception_reason is null or char_length(trim(new.exception_reason)) < 3 then
      new.exception_reason = coalesce(
        nullif(trim(new.withdrawal_reason), ''),
        'Excluded from active cohort teaching plan'
      );
    end if;
  end if;

  if new.offering_type in (
    'clinical_rotation',
    'attachment',
    'examination'
  ) then
    new.is_timetable_enabled = false;
  end if;

  if new.manually_reviewed then
    new.reviewed_by =
      coalesce(
        new.reviewed_by,
        auth.uid()
      );

    new.reviewed_at =
      coalesce(
        new.reviewed_at,
        now()
      );
  else
    new.reviewed_by = null;
    new.reviewed_at = null;
  end if;

  new.source = trim(new.source);

  if new.exception_reason is not null then
    new.exception_reason =
      trim(new.exception_reason);
  end if;

  return new;
end;
$$;

-- 4. Update set_unit_offering_approval() to populate both withdrawal_reason and exception_reason
create or replace function public.set_unit_offering_approval(
  p_offering_ids uuid[], p_approve boolean, p_reason text default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  changed integer;
  clean_reason text := coalesce(nullif(trim(p_reason), ''), 'Dropped from cohort teaching plan for this academic period');
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501', message = 'Select an authorized working department';
  end if;
  if coalesce(cardinality(p_offering_ids), 0) = 0 then
    raise exception 'Select at least one Unit on Offer';
  end if;
  if not p_approve and nullif(trim(p_reason), '') is null then
    raise exception 'Provide a reason when withdrawing an offering';
  end if;

  update public.unit_offerings offering set
    approval_status = case when p_approve
      then 'approved'::public.unit_offering_approval_status
      else 'withdrawn'::public.unit_offering_approval_status end,
    selection_state = case when p_approve
      then 'included'::public.unit_offering_selection_state
      else 'excluded'::public.unit_offering_selection_state end,
    status = case when p_approve
      then 'draft'::public.unit_offering_status
      else 'cancelled'::public.unit_offering_status end,
    is_timetable_enabled = p_approve and offering.offering_type not in
      ('attachment', 'clinical_rotation', 'examination'),
    approved_by = case when p_approve then auth.uid() else null end,
    approved_at = case when p_approve then now() else null end,
    withdrawn_by = case when p_approve then null else auth.uid() end,
    withdrawn_at = case when p_approve then null else now() end,
    withdrawal_reason = case when p_approve then null else clean_reason end,
    exception_reason = case
      when not p_approve then coalesce(clean_reason, offering.exception_reason, 'Dropped from cohort teaching plan for this academic period')
      when p_approve and offering.origin = 'curriculum' then offering.exception_reason
      when p_approve and offering.origin <> 'curriculum' then coalesce(offering.exception_reason, 'Approved cohort unit offering')
      else offering.exception_reason
    end,
    manually_reviewed = true, reviewed_by = auth.uid(), reviewed_at = now(),
    updated_by = auth.uid(), updated_at = now()
  from public.cohorts cohort
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.id = any(p_offering_ids)
    and offering.cohort_id = cohort.id
    and programme.department_id = active_department
    and not exists (
      select 1 from public.scheduled_sessions session
      join public.teaching_allocations allocation
        on allocation.id = session.teaching_allocation_id
      where allocation.source_unit_offering_id = offering.id
        and (session.is_locked or session.status = 'locked')
        and not p_approve
    );
  get diagnostics changed = row_count;
  if changed <> cardinality(p_offering_ids) then
    raise exception 'Some offerings were unavailable, outside the working department, or have locked sessions';
  end if;

  if p_approve then
    update public.teaching_allocations allocation
    set source_unit_offering_id = offering.id,
        updated_by = auth.uid(), updated_at = now()
    from public.unit_offerings offering
    where offering.id = any(p_offering_ids)
      and allocation.source_unit_offering_id is null
      and allocation.academic_period_id = offering.academic_period_id
      and allocation.cohort_id = offering.cohort_id
      and allocation.unit_id = offering.unit_id
      and (
        allocation.teaching_offering_id is null
        or exists (
          select 1 from public.teaching_offering_participants participant
          where participant.teaching_offering_id = allocation.teaching_offering_id
            and participant.unit_offering_id = offering.id
        )
      );
  else
    update public.teaching_allocations allocation
    set is_timetable_enabled = false, status = 'suspended',
        updated_by = auth.uid(), updated_at = now()
    where allocation.source_unit_offering_id = any(p_offering_ids)
      and allocation.status in ('draft', 'active');
  end if;
  return changed;
end;
$$;
