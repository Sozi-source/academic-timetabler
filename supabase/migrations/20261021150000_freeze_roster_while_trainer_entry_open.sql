-- Do not add newly registered students to a markbook roster while trainers are
-- entering marks. The next HOD prepare/open action refreshes it after it is locked.
do $$
declare
  function_definition text;
  existing_markbook_branch text := $old$if v_event_id is not null then
    -- Ensure event operational fields are active$old$;
  guarded_markbook_branch text := $new$if v_event_id is not null then
    if exists (
      select 1 from public.assessment_events
      where id = v_event_id and trainer_entry_open
    ) then
      return v_event_id;
    end if;

    -- Ensure event operational fields are active$new$;
begin
  function_definition := pg_get_functiondef(
    'public.ensure_unit_markbook_ready(uuid,uuid)'::regprocedure
  );

  if position(existing_markbook_branch in function_definition) = 0 then
    raise exception 'Could not locate the existing markbook provisioning branch.';
  end if;

  execute replace(function_definition, existing_markbook_branch, guarded_markbook_branch);
end;
$$;
