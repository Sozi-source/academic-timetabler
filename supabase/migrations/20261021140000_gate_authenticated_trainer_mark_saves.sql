-- Apply the HOD trainer-entry switch to the authenticated trainer workspace,
-- including both draft saves and submissions. Locking the event row serializes
-- an in-flight trainer save with the HOD open/lock action.
do $$
declare
  save_definition text;
  submit_definition text;
  save_old text := $old$if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'This assessment no longer accepts editable marks.'
      using errcode = '23514';
  end if;$old$;
  save_new text := $new$if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'This assessment no longer accepts editable marks.'
      using errcode = '23514';
  end if;

  if public.current_user_has_role(array['trainer']::public.app_role[]) then
    select event.trainer_entry_open
    into target_trainer_entry_open
    from public.assessment_events event
    where event.id = target_assessment_id
    for update;

    if target_trainer_entry_open is not true then
      raise exception 'Trainer mark entry is locked for this unit.'
        using errcode = '23514';
    end if;
  end if;$new$;
  submit_old text := $old$if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'This assessment has already left editable marks entry.'
      using errcode = '23514';
  end if;$old$;
  submit_new text := $new$if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'This assessment has already left editable marks entry.'
      using errcode = '23514';
  end if;

  if public.current_user_has_role(array['trainer']::public.app_role[]) then
    select event.trainer_entry_open
    into target_trainer_entry_open
    from public.assessment_events event
    where event.id = target_assessment_id
    for update;

    if target_trainer_entry_open is not true then
      raise exception 'Trainer mark entry is locked for this unit.'
        using errcode = '23514';
    end if;
  end if;$new$;
begin
  save_definition := pg_get_functiondef(
    'public.save_assessment_online_marks(uuid,jsonb)'::regprocedure
  );
  submit_definition := pg_get_functiondef(
    'public.submit_assessment_online_marks(uuid)'::regprocedure
  );

  if position(save_old in save_definition) = 0
     or position(submit_old in submit_definition) = 0
     or position('  target_unit_id uuid;' in save_definition) = 0
     or position('  target_unit_id uuid;' in submit_definition) = 0 then
    raise exception 'Could not locate trainer save and submit guards.';
  end if;

  save_definition := replace(save_definition, '  target_unit_id uuid;',
    '  target_unit_id uuid;' || E'\n' || '  target_trainer_entry_open boolean;');
  submit_definition := replace(submit_definition, '  target_unit_id uuid;',
    '  target_unit_id uuid;' || E'\n' || '  target_trainer_entry_open boolean;');
  save_definition := replace(save_definition, save_old, save_new);
  submit_definition := replace(submit_definition, submit_old, submit_new);

  execute save_definition;
  execute submit_definition;
end;
$$;
