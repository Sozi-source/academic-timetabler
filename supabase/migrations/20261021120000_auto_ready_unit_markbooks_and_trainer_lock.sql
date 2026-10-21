-- Prepare unit markbooks and rosters automatically. Trainer mark entry stays
-- locked until an HOD or system administrator opens the unit markbook.

alter table public.assessment_events
  add column if not exists trainer_entry_open boolean not null default false;

create or replace function public.prepare_unit_markbook_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.title = 'Unit Markbook' and new.assessment_type = 'exam' then
    perform public.ensure_unit_markbook_ready(new.academic_period_id, new.unit_id);
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_events_prepare_unit_markbook on public.assessment_events;
create trigger assessment_events_prepare_unit_markbook
after insert on public.assessment_events
for each row execute function public.prepare_unit_markbook_after_insert();

-- Bring existing unit markbooks up to the same ready state as new ones.
do $$
declare
  markbook record;
begin
  for markbook in
    select academic_period_id, unit_id
    from public.assessment_events
    where title = 'Unit Markbook'
      and assessment_type = 'exam'
  loop
    perform public.ensure_unit_markbook_ready(markbook.academic_period_id, markbook.unit_id);
  end loop;
end;
$$;

-- The database is the source of truth for whether trainers may save marks.
-- Role and active-department checks prevent cross-department control.
create or replace function public.set_unit_markbook_trainer_entry(
  target_assessment_id uuid,
  should_open boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_department_id uuid;
begin
  if auth.uid() is null or not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]) then
    raise exception 'HOD access is required.' using errcode = '42501';
  end if;

  select active_department_id into selected_department_id
  from public.profiles
  where id = auth.uid() and is_active;

  if not found or selected_department_id is null then
    raise exception 'Select an active department.' using errcode = '42501';
  end if;

  update public.assessment_events
  set trainer_entry_open = should_open,
      updated_at = now()
  where id = target_assessment_id
    and department_id = selected_department_id
    and title = 'Unit Markbook'
    and assessment_type = 'exam'
    and status <> 'closed'
    and exam_marks_finalized_at is null
    and not exists (
      select 1 from public.assessment_event_workspace workspace
      where workspace.id = assessment_events.id
        and workspace.workflow_status in ('submitted', 'finalised', 'archived')
    );

  if not found then
    raise exception 'This unit markbook cannot be opened or locked.' using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.set_unit_markbook_trainer_entry(uuid, boolean) from public, anon;
grant execute on function public.set_unit_markbook_trainer_entry(uuid, boolean) to authenticated;

-- Update the existing secure save function without replacing its roster,
-- component range, absence, submission, or finalized-result validations.
do $$
declare
  function_definition text;
  old_readiness_check text := $old$if target_type <> 'exam' or target_locked_at is null then
    raise exception 'The markbook roster is not ready for external mark entry.'
      using errcode = '23514';
  end if;$old$;
  new_readiness_check text := $new$select event.trainer_entry_open
  into target_trainer_entry_open
  from public.assessment_events event
  where event.id = selected_invite.assessment_id;

  if target_type <> 'exam' or target_trainer_entry_open is not true then
    raise exception 'Trainer mark entry is locked for this unit.'
      using errcode = '23514';
  end if;$new$;
  old_rule_check text := $old$select rule.maximum_mark into configured_maximum
  from public.assessment_rules as rule
  where rule.academic_period_id = target_period_id
    and rule.unit_id = target_unit_id
    and rule.assessment_type = 'exam';

  if not found or configured_maximum <> 100 then
    raise exception 'The final assessment rule must be configured to 100 marks.'
      using errcode = '23514';
  end if;$old$;
begin
  function_definition := pg_get_functiondef(
    'public.save_assessment_marks_with_trainer_invite(text,jsonb,boolean)'::regprocedure
  );

  if position(old_readiness_check in function_definition) = 0
     or position(old_rule_check in function_definition) = 0 then
    raise exception 'Could not update trainer markbook readiness checks.';
  end if;

  function_definition := replace(
    function_definition,
    '  target_unit_id uuid;',
    '  target_unit_id uuid;' || E'\n' || '  target_trainer_entry_open boolean;'
  );
  function_definition := replace(function_definition, old_readiness_check, new_readiness_check);
  function_definition := replace(function_definition, old_rule_check, '');
  execute function_definition;
end;
$$;

comment on column public.assessment_events.trainer_entry_open is
  'HOD-controlled gate for trainer mark saves on this unit markbook.';

