-- PostgreSQL has no built-in min(uuid) aggregate. The deployed allocation
-- function used min() to select the shared class fixed day and time slot,
-- causing shared-unit allocation to fail at runtime. Patch the current
-- function definition without changing its other allocation behaviour.

do $migration$
declare
  current_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(
    'public.assign_unit_offering(uuid,uuid)'::regprocedure
  )
  into current_definition;

  if position(
    'min(member.fixed_working_day_id)' in current_definition
  ) = 0 or position(
    'min(member.fixed_time_slot_id)' in current_definition
  ) = 0 then
    raise exception
      'assign_unit_offering did not contain the expected UUID aggregates';
  end if;

  corrected_definition := replace(
    current_definition,
    'min(member.fixed_working_day_id)',
    'min(member.fixed_working_day_id::text)::uuid'
  );

  corrected_definition := replace(
    corrected_definition,
    'min(member.fixed_time_slot_id)',
    'min(member.fixed_time_slot_id::text)::uuid'
  );

  execute corrected_definition;
end
$migration$;

comment on function public.assign_unit_offering(uuid, uuid) is
  'Allocates a unit offering while supporting UUID-based shared fixed schedules and soft weekly workload targets.';
