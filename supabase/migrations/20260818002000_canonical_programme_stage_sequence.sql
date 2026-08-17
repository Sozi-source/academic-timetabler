-- ============================================================
-- v12.10.5 - Canonical programme-stage sequence migration
-- Removes programme_stages.stage_number safely.
-- ============================================================

-- Canonical columns.
alter table public.programme_stages
  add column if not exists code text,
  add column if not exists sequence_number integer,
  add column if not exists year_number integer,
  add column if not exists semester_number integer;

-- Preserve legacy values before removing stage_number.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'programme_stages'
      and column_name = 'stage_number'
  ) then
    execute $q$
      update public.programme_stages
      set sequence_number = coalesce(sequence_number, stage_number)
      where sequence_number is null
    $q$;
  end if;
end
$$;

-- Canonical display metadata.
update public.programme_stages
set
  code = coalesce(
    nullif(trim(code), ''),
    'Y' || ceil(sequence_number / 3.0)::integer::text ||
    'S' || (((sequence_number - 1) % 3) + 1)::text
  ),
  name = coalesce(
    nullif(trim(name), ''),
    'Year ' || ceil(sequence_number / 3.0)::integer::text ||
    ' Semester ' || (((sequence_number - 1) % 3) + 1)::text
  ),
  year_number = coalesce(
    year_number,
    ceil(sequence_number / 3.0)::integer
  ),
  semester_number = coalesce(
    semester_number,
    ((sequence_number - 1) % 3) + 1
  )
where sequence_number is not null;

-- New canonical uniqueness must exist before functions are rewritten,
-- because some functions use ON CONFLICT(programme_id, sequence_number).
create unique index if not exists
  programme_stages_programme_sequence_unique_idx
on public.programme_stages(programme_id, sequence_number)
where sequence_number is not null;

create unique index if not exists
  programme_stages_programme_code_unique_idx
on public.programme_stages(programme_id, lower(trim(code)))
where code is not null;

-- Rewrite active PUBLIC functions that reference the standalone
-- programme_stages column `stage_number`. This deliberately does NOT
-- touch identifiers such as supplied_stage_number or
-- recommended_stage_number.
do $$
declare
  fn record;
  original_definition text;
  patched_definition text;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '\mstage_number\M'
  loop
    original_definition := pg_get_functiondef(fn.oid);

    patched_definition := regexp_replace(
      original_definition,
      '\mstage_number\M',
      'sequence_number',
      'g'
    );

    if patched_definition <> original_definition then
      execute patched_definition;
    end if;
  end loop;
end
$$;

-- Remove the old unique constraint/index if present.
alter table public.programme_stages
  drop constraint if exists programme_stages_programme_number_unique;

alter table public.programme_stages
  drop constraint if exists programme_stages_programme_stage_number_key;

drop index if exists
  public.programme_stages_programme_number_unique_idx;

drop index if exists
  public.programme_stages_programme_stage_number_unique_idx;

-- The legacy column can now be removed.
alter table public.programme_stages
  drop column if exists stage_number;

-- ============================================================
-- Approved programme stages
-- ============================================================

create temporary table _approved_programme_stages (
  programme_code text not null,
  code text not null,
  name text not null,
  sequence_number integer not null,
  year_number integer not null,
  semester_number integer not null
) on commit drop;

insert into _approved_programme_stages values
  ('CHN','Y1S1','Year 1 Semester 1',1,1,1),
  ('CHN','Y1S2','Year 1 Semester 2',2,1,2),
  ('CHN','Y1S3','Year 1 Semester 3',3,1,3),
  ('CHN','Y2S1','Year 2 Semester 1',4,2,1),
  ('CHN','Y2S2','Year 2 Semester 2',5,2,2),
  ('CHN','Y2S3','Year 2 Semester 3',6,2,3),

  ('CND','Y1S1','Year 1 Semester 1',1,1,1),
  ('CND','Y1S2','Year 1 Semester 2',2,1,2),
  ('CND','Y1S3','Year 1 Semester 3',3,1,3),
  ('CND','Y2S1','Year 2 Semester 1',4,2,1),
  ('CND','Y2S2','Year 2 Semester 2',5,2,2),
  ('CND','Y2S3','Year 2 Semester 3',6,2,3),

  ('DHN','Y1S1','Year 1 Semester 1',1,1,1),
  ('DHN','Y1S2','Year 1 Semester 2',2,1,2),
  ('DHN','Y1S3','Year 1 Semester 3',3,1,3),
  ('DHN','Y2S1','Year 2 Semester 1',4,2,1),
  ('DHN','Y2S2','Year 2 Semester 2',5,2,2),
  ('DHN','Y2S3','Year 2 Semester 3',6,2,3),
  ('DHN','Y3S1','Year 3 Semester 1',7,3,1),
  ('DHN','Y3S2','Year 3 Semester 2',8,3,2),
  ('DHN','Y3S3','Year 3 Semester 3',9,3,3),

  ('DND','Y1S1','Year 1 Semester 1',1,1,1),
  ('DND','Y1S2','Year 1 Semester 2',2,1,2),
  ('DND','Y1S3','Year 1 Semester 3',3,1,3),
  ('DND','Y2S1','Year 2 Semester 1',4,2,1),
  ('DND','Y2S2','Year 2 Semester 2',5,2,2),
  ('DND','Y2S3','Year 2 Semester 3',6,2,3),
  ('DND','Y3S1','Year 3 Semester 1',7,3,1),
  ('DND','Y3S2','Year 3 Semester 2',8,3,2),
  ('DND','Y3S3','Year 3 Semester 3',9,3,3),

  ('DNDT','Y1S1','Year 1 Semester 1',1,1,1),
  ('DNDT','Y1S2','Year 1 Semester 2',2,1,2),
  ('DNDT','Y1S3','Year 1 Semester 3',3,1,3),
  ('DNDT','Y2S1','Year 2 Semester 1',4,2,1);

-- Normalize existing approved stages.
update public.programme_stages ps
set
  department_id = p.department_id,
  code = t.code,
  name = t.name,
  sequence_number = t.sequence_number,
  year_number = t.year_number,
  semester_number = t.semester_number,
  is_active = true,
  updated_at = now()
from public.programmes p
join _approved_programme_stages t
  on upper(trim(p.code)) = t.programme_code
where ps.programme_id = p.id
  and (
    ps.sequence_number = t.sequence_number
    or lower(trim(coalesce(ps.code, ''))) = lower(t.code)
  );

-- Insert missing stages. department_id is mandatory in the existing schema.
insert into public.programme_stages (
  department_id,
  programme_id,
  code,
  name,
  sequence_number,
  year_number,
  semester_number,
  is_active
)
select
  p.department_id,
  p.id,
  t.code,
  t.name,
  t.sequence_number,
  t.year_number,
  t.semester_number,
  true
from public.programmes p
join _approved_programme_stages t
  on upper(trim(p.code)) = t.programme_code
where not exists (
  select 1
  from public.programme_stages ps
  where ps.programme_id = p.id
    and ps.sequence_number = t.sequence_number
);

-- DHNT is intentionally excluded from the approved structure.

-- ============================================================
-- Automatically bind existing curriculum units to stages using
-- units.academic_period_number and the existing join table.
-- ============================================================

do $$
declare
  has_department_id boolean;
begin
  if to_regclass('public.programme_stage_units') is null then
    raise exception
      'public.programme_stage_units is required for stage-unit binding';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'programme_stage_units'
      and column_name = 'department_id'
  )
  into has_department_id;

  if has_department_id then
    execute $q$
      insert into public.programme_stage_units (
        department_id,
        stage_id,
        unit_id
      )
      select
        ps.department_id,
        ps.id,
        u.id
      from public.units u
      join public.programme_stages ps
        on ps.programme_id = u.programme_id
       and ps.sequence_number = u.academic_period_number
      where ps.is_active
      on conflict do nothing
    $q$;
  else
    execute $q$
      insert into public.programme_stage_units (
        stage_id,
        unit_id
      )
      select
        ps.id,
        u.id
      from public.units u
      join public.programme_stages ps
        on ps.programme_id = u.programme_id
       and ps.sequence_number = u.academic_period_number
      where ps.is_active
      on conflict do nothing
    $q$;
  end if;
end
$$;

comment on column public.programme_stages.sequence_number is
  'Canonical programme-stage order: 1=Y1S1, 2=Y1S2, 3=Y1S3, etc.';

comment on column public.programme_stages.code is
  'Human-readable academic stage code such as Y1S1 or Y2S3.';
