-- A trainer-pending reservation is intentionally editable. Saving a fixed
-- schedule must update both the Unit on Offer configuration and its existing
-- null-trainer teaching allocation so regeneration uses the new periods.

do $migration$
declare
  current_definition text;
  corrected_definition text;
  standard_anchor text := E'  where member.id = any(target_offering_ids);\nend;';
  standard_replacement text := E'  where member.id = any(target_offering_ids);\n\n  -- Synchronize any existing trainer-pending reservation.\n  update public.teaching_allocations allocation\n  set\n    fixed_working_day_id = p_working_day_ids[1],\n    fixed_working_day_ids = p_working_day_ids,\n    fixed_time_slot_ids = p_time_slot_ids,\n    is_full_day_session = false,\n    fixed_end_time_slot_id = null,\n    updated_at = now(),\n    updated_by = auth.uid()\n  where allocation.academic_period_id = offering.academic_period_id\n    and allocation.trainer_id is null\n    and allocation.status in (''draft'', ''active'', ''suspended'')\n    and (\n      (\n        offering.confirmed_shared_offering_id is not null\n        and allocation.teaching_offering_id =\n          offering.confirmed_shared_offering_id\n      )\n      or (\n        offering.confirmed_shared_offering_id is null\n        and allocation.teaching_offering_id is null\n        and allocation.cohort_id = offering.cohort_id\n        and allocation.unit_id = offering.unit_id\n      )\n    );\nend;';
  full_day_anchor text := E'    where shared_offering.id = offering.confirmed_shared_offering_id;\n  end if;\nend;';
  full_day_replacement text := E'    where shared_offering.id = offering.confirmed_shared_offering_id;\n  end if;\n\n  -- Synchronize any existing trainer-pending full-day reservation.\n  update public.teaching_allocations allocation\n  set\n    fixed_working_day_id = p_working_day_id,\n    fixed_working_day_ids = array[p_working_day_id],\n    fixed_time_slot_ids = array[first_slot_id],\n    is_full_day_session = true,\n    fixed_end_time_slot_id = last_slot_id,\n    weekly_sessions = 1,\n    session_duration_minutes = 480,\n    delivery_mode = ''clinical''::public.teaching_delivery_mode,\n    updated_at = now(),\n    updated_by = auth.uid()\n  where allocation.academic_period_id = offering.academic_period_id\n    and allocation.trainer_id is null\n    and allocation.status in (''draft'', ''active'', ''suspended'')\n    and (\n      (\n        offering.confirmed_shared_offering_id is not null\n        and allocation.teaching_offering_id =\n          offering.confirmed_shared_offering_id\n      )\n      or (\n        offering.confirmed_shared_offering_id is null\n        and allocation.teaching_offering_id is null\n        and allocation.cohort_id = offering.cohort_id\n        and allocation.unit_id = offering.unit_id\n      )\n    );\nend;';
begin
  select pg_get_functiondef(
    'public.set_unit_offering_fixed_session_pattern(uuid,uuid[],uuid[])'::regprocedure
  )
  into current_definition;

  if position(
    'Synchronize any existing trainer-pending reservation'
    in current_definition
  ) = 0 then
    if position(standard_anchor in current_definition) = 0 then
      raise exception
        'The fixed-session function did not contain the expected update block';
    end if;

    corrected_definition := replace(
      current_definition,
      standard_anchor,
      standard_replacement
    );

    execute corrected_definition;
  end if;

  select pg_get_functiondef(
    'public.set_unit_offering_full_day_schedule(uuid,uuid)'::regprocedure
  )
  into current_definition;

  if position(
    'Synchronize any existing trainer-pending full-day reservation'
    in current_definition
  ) = 0 then
    if position(full_day_anchor in current_definition) = 0 then
      raise exception
        'The full-day function did not contain the expected update block';
    end if;

    corrected_definition := replace(
      current_definition,
      full_day_anchor,
      full_day_replacement
    );

    execute corrected_definition;
  end if;
end
$migration$;

comment on function public.set_unit_offering_fixed_session_pattern(uuid, uuid[], uuid[]) is
  'Saves fixed weekly sessions and synchronizes an existing trainer-pending reservation.';

comment on function public.set_unit_offering_full_day_schedule(uuid, uuid) is
  'Saves a full-day schedule and synchronizes an existing trainer-pending reservation.';
