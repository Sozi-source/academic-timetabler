-- Batch unit registration must only include admitted/active students who are
-- not currently on attachment. Keep the same eligibility rule in both RPCs.
do $$
declare
  expected_definition text;
  override_definition text;
  updated_expected_definition text;
  updated_override_definition text;
begin
  expected_definition := pg_get_functiondef(
    'public.batch_register_expected_student_units(uuid,uuid,uuid[])'::regprocedure
  );
  updated_expected_definition := replace(
    expected_definition,
    's.lifecycle_status in (''admitted'',''active'')',
    's.lifecycle_status in (''admitted'',''active'') and coalesce(s.academic_phase::text, '''') <> ''attachment'''
  );
  if updated_expected_definition = expected_definition then
    raise exception 'Could not apply attachment eligibility rule to batch_register_expected_student_units';
  end if;
  execute updated_expected_definition;

  override_definition := pg_get_functiondef(
    'public.batch_register_override_units(uuid,uuid[],uuid[],text)'::regprocedure
  );
  updated_override_definition := replace(
    override_definition,
    'and s.lifecycle_status in (''admitted'', ''active'')',
    'and s.lifecycle_status in (''admitted'', ''active'') and coalesce(s.academic_phase::text, '''') <> ''attachment'''
  );
  if updated_override_definition = override_definition then
    raise exception 'Could not apply attachment eligibility rule to batch_register_override_units';
  end if;
  execute updated_override_definition;
end;
$$;
