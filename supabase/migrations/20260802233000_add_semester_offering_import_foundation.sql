-- ============================================================
-- Semester Offering import foundation
--
-- unit_offerings becomes a supported standardized import
-- entity.
--
-- shared_class_key groups multiple programme-specific Units on
-- Offer into one Teaching Offering while preserving each
-- official curriculum unit and code.
-- ============================================================

-- PostgreSQL enum values must be added independently of table
-- creation. IF NOT EXISTS keeps the migration safe to rerun in
-- development environments.
alter type public.import_entity_type
add value if not exists 'unit_offerings';

-- ------------------------------------------------------------
-- Shared-class identity
-- ------------------------------------------------------------

alter table public.teaching_offerings
add column shared_class_key text;

alter table public.teaching_offerings
add constraint teaching_offerings_shared_class_key_check
check (
  shared_class_key is null
  or char_length(shared_class_key)
      between 3 and 120
);

-- Within one Academic Period, one shared key identifies one
-- schedulable Teaching Offering.
create unique index
  teaching_offerings_period_shared_class_key_unique_idx
on public.teaching_offerings (
  academic_period_id,
  shared_class_key
)
where shared_class_key is not null;

create index
  teaching_offerings_shared_class_key_idx
on public.teaching_offerings (
  shared_class_key
)
where shared_class_key is not null;

-- ------------------------------------------------------------
-- Normalize shared keys at database level
-- ------------------------------------------------------------

create or replace function
  public.normalize_shared_class_key(
    supplied_key text
  )
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(
    upper(
      regexp_replace(
        trim(coalesce(supplied_key, '')),
        '[^A-Za-z0-9]+',
        '-',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function
  public.normalize_teaching_offering_shared_key()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.shared_class_key =
    public.normalize_shared_class_key(
      new.shared_class_key
    );

  return new;
end;
$$;

create trigger
  teaching_offerings_normalize_shared_key
before insert or update of shared_class_key
on public.teaching_offerings
for each row
execute function
  public.normalize_teaching_offering_shared_key();

-- ------------------------------------------------------------
-- Import-batch helper
--
-- Records the chosen import mode without changing the generic
-- import batch structure.
-- ------------------------------------------------------------

comment on column
  public.teaching_offerings.shared_class_key is
  'Optional Academic Period-scoped identifier used to group programme-specific Units on Offer into one shared schedulable Teaching Offering.';

comment on function
  public.normalize_shared_class_key(text) is
  'Normalizes imported shared-class identifiers to uppercase hyphen-separated keys.';