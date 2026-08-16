-- Hotfix for databases where v8.4 and v8.5 are already applied. An assigned
-- placement can become invalid when a separated cohort is rejoined. Preserve
-- the trainer allocation but clear the unlocked draft placement before the
-- participant triggers run, so generation can choose a valid time afterward.

do $migration$
declare
  function_definition text;
  insertion_anchor text :=
    '      -- Remove the redundant trainer-pending draft from the active timetable';
  reschedule_block text := E'      if exists (\n'
    || E'        select 1\n'
    || E'        from public.scheduled_sessions session\n'
    || E'        where session.teaching_allocation_id = assigned_allocation.id\n'
    || E'          and (session.is_locked = true or session.status = ''locked'')\n'
    || E'      ) or exists (\n'
    || E'        select 1\n'
    || E'        from public.timetable_versions version\n'
    || E'        cross join lateral jsonb_array_elements(version.snapshot) snapshot_session\n'
    || E'        join public.scheduled_sessions session\n'
    || E'          on snapshot_session ->> ''id'' = session.id::text\n'
    || E'        where version.academic_period_id = p_academic_period_id\n'
    || E'          and version.status in (''under_review'', ''approved'', ''published'')\n'
    || E'          and session.teaching_allocation_id = assigned_allocation.id\n'
    || E'      ) then\n'
    || E'        review_count := review_count + 1;\n'
    || E'        review_items := review_items || jsonb_build_array(jsonb_build_object(\n'
    || E'          ''allocationId'', pending.id,\n'
    || E'          ''unitCode'', pending.unit_code,\n'
    || E'          ''unitName'', pending.unit_name,\n'
    || E'          ''cohortCode'', pending.cohort_code,\n'
    || E'          ''reason'', ''Reopen or unlock the assigned timetable session before merging this class''\n'
    || E'        ));\n'
    || E'        continue;\n'
    || E'      end if;\n\n'
    || E'      -- The assigned placement may be valid for its old participant list but\n'
    || E'      -- clash after another cohort is rejoined. Keep the trainer allocation,\n'
    || E'      -- clear only the editable draft placement, then regenerate safely.\n'
    || E'      update public.scheduled_sessions session\n'
    || E'      set\n'
    || E'        status = ''cancelled'',\n'
    || E'        conflict_state = ''clear'',\n'
    || E'        notes = left(concat_ws(\n'
    || E'          '' '',\n'
    || E'          nullif(trim(session.notes), ''''),\n'
    || E'          ''Placement cleared because shared-class participants changed; regenerate the draft timetable.''\n'
    || E'        ), 1000),\n'
    || E'        updated_at = now(),\n'
    || E'        updated_by = auth.uid()\n'
    || E'      where session.teaching_allocation_id = assigned_allocation.id\n'
    || E'        and session.status not in (''cancelled'', ''archived'');\n\n';
begin
  select pg_get_functiondef(
    'public.reconcile_previous_trainer_assignments(uuid)'::regprocedure
  )
  into function_definition;

  if position(
    'Placement cleared because shared-class participants changed'
    in function_definition
  ) > 0 then
    raise notice 'Shared-class rescheduling hotfix is already present';
  elsif position(insertion_anchor in function_definition) = 0 then
    raise exception
      'Unable to locate the reconciliation insertion point; v8.5 must be applied first';
  else
    execute replace(
      function_definition,
      insertion_anchor,
      reschedule_block || insertion_anchor
    );
  end if;
end;
$migration$;

comment on function public.reconcile_previous_trainer_assignments(uuid) is
  'Rejoins separated equivalents while preserving trainer allocations, clearing only editable placements whose participant membership changed, and protecting locked or published sessions.';
