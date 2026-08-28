-- PostgreSQL resolves CASE branches containing only string literals as text.
-- Cast each branch explicitly so authorization updates enum-backed columns.

create or replace function public.set_unit_offering_approval(
  p_offering_ids uuid[], p_approve boolean, p_reason text default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  changed integer;
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
    withdrawal_reason = case when p_approve then null else trim(p_reason) end,
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
