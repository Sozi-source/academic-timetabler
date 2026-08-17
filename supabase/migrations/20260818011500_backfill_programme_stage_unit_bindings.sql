-- v12.15.1
-- Backfill existing programme_stage_units from the canonical curriculum structure.
--
-- Existing application contract:
--   programme_stage_units.stage_id
--   programme_stage_units.unit_id
--
-- Canonical matching rule:
--   programme_stages.programme_id = units.programme_id
--   programme_stages.sequence_number = units.academic_period_number
--
-- This migration does NOT create a second binding table and does NOT
-- overwrite manual bindings. It inserts only missing bindings.

do $$
begin
  if to_regclass('public.programme_stage_units') is null then
    raise exception
      'public.programme_stage_units does not exist; expected existing stage-unit binding foundation';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'programme_stage_units'
      and column_name = 'stage_id'
  ) then
    raise exception
      'public.programme_stage_units.stage_id does not exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'programme_stage_units'
      and column_name = 'unit_id'
  ) then
    raise exception
      'public.programme_stage_units.unit_id does not exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'programme_stages'
      and column_name = 'sequence_number'
  ) then
    raise exception
      'public.programme_stages.sequence_number does not exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'units'
      and column_name = 'academic_period_number'
  ) then
    raise exception
      'public.units.academic_period_number does not exist';
  end if;
end
$$;

insert into public.programme_stage_units (
  stage_id,
  unit_id
)
select
  ps.id,
  u.id
from public.programme_stages ps
join public.units u
  on u.programme_id = ps.programme_id
 and u.academic_period_number = ps.sequence_number
where ps.is_active = true
  and u.academic_period_number is not null
  and not exists (
    select 1
    from public.programme_stage_units psu
    where psu.stage_id = ps.id
      and psu.unit_id = u.id
  );

-- Keep the table protected from duplicate bindings even if the original
-- migration did not create a unique constraint.
create unique index if not exists
  programme_stage_units_stage_unit_unique_idx
on public.programme_stage_units (
  stage_id,
  unit_id
);

-- Lightweight audit view for the UI/admin checks.
create or replace view public.programme_stage_binding_health
with (security_invoker = true)
as
select
  ps.id as stage_id,
  ps.programme_id,
  p.code as programme_code,
  ps.code as stage_code,
  ps.name as stage_name,
  ps.sequence_number,
  count(psu.unit_id)::integer as bound_unit_count
from public.programme_stages ps
join public.programmes p
  on p.id = ps.programme_id
left join public.programme_stage_units psu
  on psu.stage_id = ps.id
where ps.is_active = true
group by
  ps.id,
  ps.programme_id,
  p.code,
  ps.code,
  ps.name,
  ps.sequence_number;
