-- PostgreSQL has no built-in min(uuid) aggregate. The readiness bulk-include
-- function used it to select one representative from a shared Unit on Offer,
-- which caused "Include all unassigned units" to fail at runtime.

do $migration$
declare
  current_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(
    'public.include_all_unassigned_unit_offerings(uuid)'::regprocedure
  )
  into current_definition;

  if position('min(member.id)' in current_definition) = 0 then
    raise notice
      'include_all_unassigned_unit_offerings already avoids min(uuid)';
    return;
  end if;

  corrected_definition := replace(
    current_definition,
    'min(member.id)',
    'min(member.id::text)::uuid'
  );

  execute corrected_definition;
end
$migration$;

comment on function public.include_all_unassigned_unit_offerings(uuid) is
  'Creates trainer-pending allocations for all unassigned Units on Offer in the current working department without UUID aggregates.';
