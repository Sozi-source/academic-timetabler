-- The manual cohort-unit workflow records cross-stage local arrangements as
-- origin=special. Extend the existing audited cross-stage allocation exception
-- to that origin; the authoritative-offering trigger separately requires the
-- exact source offering to be approved, included and timetable-enabled.

do $$
declare
  function_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(procedure_record.oid)
  into function_definition
  from pg_proc procedure_record
  join pg_namespace namespace_record
    on namespace_record.oid = procedure_record.pronamespace
  where namespace_record.nspname = 'public'
    and procedure_record.proname = 'validate_teaching_allocation'
    and procedure_record.pronargs = 0;

  if function_definition is null then
    raise exception 'public.validate_teaching_allocation() was not found';
  end if;

  if position('offering.origin in (''legacy'', ''special'')' in function_definition) > 0 then
    return;
  end if;

  updated_definition := replace(
    function_definition,
    'offering.origin = ''legacy''',
    'offering.origin in (''legacy'', ''special'')'
  );

  if updated_definition = function_definition then
    raise exception 'The cross-stage offering validation clause was not found';
  end if;

  execute updated_definition;
end;
$$;

comment on function public.validate_teaching_allocation() is
  'Validates timetable allocations and permits cross-stage units only through an enabled, audited legacy or local-arrangement Unit on Offer exception.';
