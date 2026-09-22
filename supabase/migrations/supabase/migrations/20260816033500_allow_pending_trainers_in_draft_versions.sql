-- Draft timetable versions are working snapshots and may contain sessions
-- whose trainer assignment is still pending. Final publication remains
-- protected and requires a complete, internally consistent snapshot.

do $migration$
declare
  current_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(
    'public.create_timetable_version(uuid,text,text)'::regprocedure
  ) into current_definition;

  corrected_definition := current_definition;

  if position(
    'left join public.trainers trainer on trainer.id = session.trainer_id'
    in corrected_definition
  ) > 0 then
    null;
  elsif position(
    'join public.trainers trainer on trainer.id = session.trainer_id'
    in corrected_definition
  ) > 0 then
    corrected_definition := replace(
      corrected_definition,
      'join public.trainers trainer on trainer.id = session.trainer_id',
      'left join public.trainers trainer on trainer.id = session.trainer_id'
    );
  else
    raise exception
      'create_timetable_version did not contain the expected trainer join';
  end if;

  corrected_definition := replace(
    corrected_definition,
    E'''trainerName'', trainer.full_name,',
    E'''trainerName'', coalesce(trainer.full_name, ''Trainer pending''),'
  );

  if corrected_definition is distinct from current_definition then
    execute corrected_definition;
  end if;
end
$migration$;

create or replace function public.block_timetable_version_with_pending_trainers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' then
    return new;
  end if;

  if jsonb_typeof(new.snapshot) <> 'array'
    or jsonb_array_length(new.snapshot) <> new.session_count then
    raise exception
      'This version has an incomplete snapshot. Create a new timetable version before publishing';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.snapshot) snapshot_session
    where nullif(snapshot_session ->> 'trainerId', '') is null
  ) then
    raise exception
      'Assign trainers to every trainer-pending session and create a new version before publishing';
  end if;

  if exists (
    select 1
    from public.scheduled_sessions session
    join public.cohorts cohort
      on cohort.id = session.cohort_id
    join public.programmes programme
      on programme.id = cohort.programme_id
    where session.academic_period_id = new.academic_period_id
      and programme.department_id = new.department_id
      and session.trainer_id is null
      and session.status in ('draft', 'confirmed', 'locked')
  ) then
    raise exception
      'Assign trainers to every trainer-pending timetable session before publishing';
  end if;

  return new;
end;
$$;

drop trigger if exists timetable_versions_require_trainers
on public.timetable_versions;

create trigger timetable_versions_require_trainers
before insert or update of status
on public.timetable_versions
for each row
execute function public.block_timetable_version_with_pending_trainers();

comment on function public.block_timetable_version_with_pending_trainers() is
  'Allows trainer-pending draft/review versions but blocks final publication until both the snapshot and current timetable have trainers assigned.';
