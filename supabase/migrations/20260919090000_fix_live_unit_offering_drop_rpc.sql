-- Fix the live unit-offering drop RPC.
-- The previous migration is already applied remotely, so this replacement must
-- be delivered as a new migration.

drop function if exists public.set_unit_offering_approval(uuid[], boolean, text);
drop function if exists public.set_unit_offering_approval(uuid[], boolean);

create or replace function public.set_unit_offering_approval(
  p_offering_ids uuid[],
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  changed integer := 0;
  clean_reason text := coalesce(
    nullif(trim(p_reason), ''),
    'Dropped from cohort teaching plan for this academic period'
  );
  blocked_ids uuid[];
  offering_row record;
  affected_allocation_ids uuid[];
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

  select array_agg(offering.id)
  into blocked_ids
  from public.unit_offerings offering
  join public.cohorts cohort on cohort.id = offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.id = any(p_offering_ids)
    and not (
      programme.department_id = active_department
      or public.current_user_can_manage_department(programme.department_id)
    );

  update public.unit_offerings offering
  set approval_status = case when p_approve
        then 'approved'::public.unit_offering_approval_status
        else 'withdrawn'::public.unit_offering_approval_status end,
      selection_state = case when p_approve
        then 'included'::public.unit_offering_selection_state
        else 'excluded'::public.unit_offering_selection_state end,
      status = case when p_approve
        then 'draft'::public.unit_offering_status
        else 'cancelled'::public.unit_offering_status end,
      is_timetable_enabled = p_approve
        and offering.offering_type not in ('attachment', 'clinical_rotation', 'examination'),
      approved_by = case when p_approve then auth.uid() else null end,
      approved_at = case when p_approve then now() else null end,
      withdrawn_by = case when p_approve then null else auth.uid() end,
      withdrawn_at = case when p_approve then null else now() end,
      withdrawal_reason = case when p_approve then null else clean_reason end,
      exception_reason = case
        when not p_approve then clean_reason
        when offering.origin = 'curriculum' then offering.exception_reason
        else coalesce(offering.exception_reason, 'Approved cohort unit offering')
      end,
      manually_reviewed = true,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  from public.cohorts cohort
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.id = any(p_offering_ids)
    and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
    and offering.cohort_id = cohort.id
    and (
      programme.department_id = active_department
      or public.current_user_can_manage_department(programme.department_id)
    );

  get diagnostics changed = row_count;

  if p_approve then
    update public.teaching_allocations allocation
    set source_unit_offering_id = offering.id,
        is_timetable_enabled = offering.offering_type not in ('attachment', 'clinical_rotation', 'examination'),
        status = case when allocation.status in ('suspended', 'archived') then 'draft' else allocation.status end,
        updated_by = auth.uid(),
        updated_at = now()
    from public.unit_offerings offering
    where offering.id = any(p_offering_ids)
      and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
      and allocation.academic_period_id = offering.academic_period_id
      and allocation.cohort_id = offering.cohort_id
      and allocation.unit_id = offering.unit_id;

    insert into public.teaching_allocations (
      academic_period_id, cohort_id, unit_id, trainer_id,
      source_unit_offering_id, delivery_mode, weekly_sessions,
      session_duration_minutes, status, is_timetable_enabled,
      participant_cohort_ids, combined_cohort_size, notes,
      created_by, updated_by
    )
    select distinct on (offering.academic_period_id, offering.cohort_id, offering.unit_id)
      offering.academic_period_id, offering.cohort_id, offering.unit_id, null,
      offering.id,
      case when offering.offering_type = 'practical'
        then 'practical'::public.teaching_delivery_mode
        else 'theory'::public.teaching_delivery_mode end,
      coalesce(offering.weekly_sessions, unit.weekly_sessions, 1),
      coalesce(offering.session_duration_minutes, 120),
      'draft', true, array[offering.cohort_id], coalesce(cohort.actual_size, 0),
      'Approved cohort unit offering ready for timetabling', auth.uid(), auth.uid()
    from public.unit_offerings offering
    join public.cohorts cohort on cohort.id = offering.cohort_id
    join public.units unit on unit.id = offering.unit_id
    where offering.id = any(p_offering_ids)
      and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
      and offering.offering_type not in ('attachment', 'clinical_rotation', 'examination')
      and not exists (
        select 1 from public.teaching_allocations existing
        where existing.academic_period_id = offering.academic_period_id
          and existing.cohort_id = offering.cohort_id
          and existing.unit_id = offering.unit_id
      )
    on conflict (academic_period_id, cohort_id, unit_id)
      where status in ('draft', 'active', 'suspended')
    do update set
      source_unit_offering_id = excluded.source_unit_offering_id,
      is_timetable_enabled = true,
      status = 'draft',
      updated_by = auth.uid(),
      updated_at = now();
  else
    for offering_row in
      select offering.id as offering_id,
             offering.cohort_id,
             offering.unit_id,
             offering.academic_period_id
      from public.unit_offerings offering
      where offering.id = any(p_offering_ids)
        and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
    loop
      select coalesce(array_agg(allocation.id), '{}'::uuid[])
      into affected_allocation_ids
      from public.teaching_allocations allocation
      where allocation.academic_period_id = offering_row.academic_period_id
        and allocation.unit_id = offering_row.unit_id
        and (
          allocation.source_unit_offering_id = offering_row.offering_id
          or allocation.cohort_id = offering_row.cohort_id
          or offering_row.cohort_id = any(coalesce(allocation.participant_cohort_ids, '{}'::uuid[]))
        );

      -- Cancel first. A draft session cannot remain backed by a suspended
      -- allocation or a withdrawn offering under the authority trigger.
      update public.scheduled_sessions session
      set status = 'cancelled'::public.scheduled_session_status,
          conflict_state = 'clear'::public.scheduled_session_conflict_state,
          is_locked = false,
          notes = left(concat_ws(
            ' ', nullif(trim(session.notes), ''),
            'Cancelled because unit offering was dropped by HOD.'
          ), 1000),
          updated_by = auth.uid(),
          updated_at = now()
      where session.teaching_allocation_id = any(affected_allocation_ids)
        and session.status not in ('cancelled', 'archived');

      delete from public.teaching_offering_participants participant
      where participant.unit_offering_id = offering_row.offering_id
         or (
           participant.cohort_id = offering_row.cohort_id
           and participant.unit_id = offering_row.unit_id
           and participant.teaching_offering_id in (
             select shared.id
             from public.teaching_offerings shared
             where shared.academic_period_id = offering_row.academic_period_id
           )
         );

      with ranked_own_allocations as (
        select allocation.id,
               row_number() over (
                 partition by allocation.academic_period_id, allocation.cohort_id, allocation.unit_id
                 order by
                   case allocation.status
                     when 'active' then 1
                     when 'draft' then 2
                     when 'suspended' then 3
                     else 4
                   end,
                   allocation.updated_at desc
               ) as rn
        from public.teaching_allocations allocation
        where allocation.id = any(affected_allocation_ids)
          and (
            allocation.cohort_id = offering_row.cohort_id
            or allocation.source_unit_offering_id = offering_row.offering_id
          )
      )
      update public.teaching_allocations allocation
      set is_timetable_enabled = false,
          status = case when ranked.rn = 1 then 'suspended'::public.teaching_allocation_status else 'archived'::public.teaching_allocation_status end,
          participant_cohort_ids = array_remove(
            coalesce(allocation.participant_cohort_ids, '{}'::uuid[]),
            offering_row.cohort_id
          ),
          combined_cohort_size = public.resolve_participant_cohort_size(
            array_remove(
              coalesce(allocation.participant_cohort_ids, '{}'::uuid[]),
              offering_row.cohort_id
            )
          ),
          updated_by = auth.uid(),
          updated_at = now()
      from ranked_own_allocations ranked
      where allocation.id = ranked.id;

      update public.teaching_allocations allocation
      set participant_cohort_ids = array_remove(
            coalesce(allocation.participant_cohort_ids, '{}'::uuid[]),
            offering_row.cohort_id
          ),
          combined_cohort_size = public.resolve_participant_cohort_size(
            array_remove(
              coalesce(allocation.participant_cohort_ids, '{}'::uuid[]),
              offering_row.cohort_id
            )
          ),
          updated_by = auth.uid(),
          updated_at = now()
      where allocation.academic_period_id = offering_row.academic_period_id
        and allocation.unit_id = offering_row.unit_id
        and offering_row.cohort_id = any(coalesce(allocation.participant_cohort_ids, '{}'::uuid[]));
    end loop;
  end if;

  return jsonb_build_object(
    'changed', changed,
    'blocked', coalesce(cardinality(blocked_ids), 0),
    'blocked_ids', coalesce(to_jsonb(blocked_ids), '[]'::jsonb),
    'message', case
      when coalesce(cardinality(blocked_ids), 0) = 0 then null
      when changed = 0 then 'Offerings could not be updated because they belong to departments you cannot manage.'
      else format('%s offering(s) updated. %s offering(s) were skipped because they belong to other departments.', changed, cardinality(blocked_ids))
    end
  );
end;
$$;

revoke all on function public.set_unit_offering_approval(uuid[], boolean, text) from public;
grant execute on function public.set_unit_offering_approval(uuid[], boolean, text) to authenticated;
