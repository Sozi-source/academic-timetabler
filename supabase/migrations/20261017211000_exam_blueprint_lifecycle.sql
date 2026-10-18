begin;

-- The foundation migration is already deployed. Make blueprint naming
-- department-aware and enforce one active version for each programme scope.
alter table public.exam_blueprints
  drop constraint if exists exam_blueprints_name_version_unique;
alter table public.exam_blueprints
  drop constraint if exists exam_blueprints_name_length_check;
alter table public.exam_blueprints
  add constraint exam_blueprints_name_length_check
  check (length(trim(name)) between 2 and 120);

do $$
begin
  if exists (
    select 1
    from public.exam_blueprints
    group by department_id, lower(trim(name)), version_number
    having count(*) > 1
  ) then
    raise exception 'Resolve duplicate blueprint names/versions within each department before applying this migration';
  end if;

  if exists (
    select 1
    from public.exam_blueprints
    where status = 'active'
    group by department_id,
      coalesce(programme_id, '00000000-0000-0000-0000-000000000000'::uuid),
      lower(trim(name))
    having count(*) > 1
  ) then
    raise exception 'Retire duplicate active blueprint versions within each programme scope before applying this migration';
  end if;
end;
$$;

create unique index if not exists exam_blueprints_department_name_version_unique
  on public.exam_blueprints (department_id, lower(trim(name)), version_number);
create unique index if not exists exam_blueprints_one_active_version_idx
  on public.exam_blueprints (
    department_id,
    coalesce(programme_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(trim(name))
  ) where status = 'active';

create or replace function public.exam_set_blueprint_status(
  requested_blueprint uuid,
  requested_status text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  target public.exam_blueprints%rowtype;
begin
  if requested_status not in ('active', 'retired') then
    raise exception 'Unsupported blueprint status';
  end if;

  select * into target
  from public.exam_blueprints
  where id = requested_blueprint
  for update;

  if not found
    or not public.current_user_can_manage_department(target.department_id) then
    raise exception 'Blueprint not found or access denied';
  end if;

  if requested_status = 'active' then
    update public.exam_blueprints
    set status = 'retired'
    where department_id = target.department_id
      and programme_id is not distinct from target.programme_id
      and lower(trim(name)) = lower(trim(target.name))
      and status = 'active'
      and id <> target.id;
  end if;

  update public.exam_blueprints
  set status = requested_status
  where id = target.id;
end;
$$;
revoke all on function public.exam_set_blueprint_status(uuid, text) from public;
grant execute on function public.exam_set_blueprint_status(uuid, text) to authenticated;

commit;
