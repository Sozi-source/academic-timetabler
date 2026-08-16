-- A small number of trainer-pending sessions may be published when the
-- timetable itself is conflict-free. The immutable snapshot records the null
-- trainer id and uses an explicit UNASSIGNED label for clear follow-up.

do $migration$
declare
  current_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(
    'public.create_timetable_version(uuid,text,text)'::regprocedure
  ) into current_definition;

  corrected_definition := current_definition;

  if position('Trainer pending' in corrected_definition) > 0 then
    corrected_definition := replace(
      corrected_definition,
      'Trainer pending',
      'UNASSIGNED'
    );
  elsif position('UNASSIGNED' in corrected_definition) = 0 then
    raise exception
      'create_timetable_version did not contain the expected unassigned trainer label';
  end if;

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

  return new;
end;
$$;

comment on function public.block_timetable_version_with_pending_trainers() is
  'Validates snapshot completeness while allowing publication with explicitly labelled unassigned trainers.';
