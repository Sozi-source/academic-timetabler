-- Hotfix for databases where 20260816035000 has already been applied.
-- Cancel the redundant pending draft before participant triggers expand the
-- assigned class. The normal cohort-clash trigger remains enabled.

do $migration$
declare
  function_definition text;
  insertion_anchor text :=
    '      target_shared_offering_id := assigned_allocation.teaching_offering_id;';
  early_cancellation text := E'      -- Remove the redundant trainer-pending draft from the active timetable\n'
    || E'      -- before expanding the assigned class participant list. Otherwise the\n'
    || E'      -- participant refresh correctly sees both sessions and raises a clash.\n'
    || E'      update public.scheduled_sessions session\n'
    || E'      set\n'
    || E'        status = ''cancelled'',\n'
    || E'        conflict_state = ''clear'',\n'
    || E'        notes = left(concat_ws(\n'
    || E'          '' '',\n'
    || E'          nullif(trim(session.notes), ''''),\n'
    || E'          ''Cancelled before rejoining the pending duplicate to its assigned shared class.''\n'
    || E'        ), 1000),\n'
    || E'        updated_at = now(),\n'
    || E'        updated_by = auth.uid()\n'
    || E'      where session.teaching_allocation_id = pending.id\n'
    || E'        and session.status not in (''cancelled'', ''archived'');\n\n';
begin
  select pg_get_functiondef(
    'public.reconcile_previous_trainer_assignments(uuid)'::regprocedure
  )
  into function_definition;

  if position(
    'Cancelled before rejoining the pending duplicate'
    in function_definition
  ) > 0 then
    raise notice 'Reconciliation clash-order hotfix is already present';
  elsif position(insertion_anchor in function_definition) = 0 then
    raise exception
      'Unable to locate the reconciliation insertion point; v8.4 must be applied first';
  else
    execute replace(
      function_definition,
      insertion_anchor,
      early_cancellation || insertion_anchor
    );
  end if;
end;
$migration$;

comment on function public.reconcile_previous_trainer_assignments(uuid) is
  'Rejoins separated trainer-pending equivalents after cancelling their redundant drafts first; normal cohort clash validation remains enforced.';
