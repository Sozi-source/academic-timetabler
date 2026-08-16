-- A readiness participant may be a valid carry-over/legacy offering from a
-- different curriculum stage. Normalize only those bulk-generated rows before
-- the standard curriculum-stage validation trigger runs.

create or replace function
  public.normalize_readiness_bulk_unit_offering_stage()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cohort_stage integer;
  unit_stage integer;
begin
  if new.source <> 'readiness_bulk_include'
    or new.origin <> 'curriculum' then
    return new;
  end if;

  select cohort.current_academic_period_number
  into cohort_stage
  from public.cohorts cohort
  where cohort.id = new.cohort_id;

  select unit_record.academic_period_number
  into unit_stage
  from public.units unit_record
  where unit_record.id = new.unit_id;

  if unit_stage is distinct from cohort_stage then
    new.origin = 'legacy'::public.unit_offering_origin;
    new.recommended_stage_number = null;
    new.exception_reason = coalesce(
      new.exception_reason,
      'Cross-stage teaching offering retained from the readiness register'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists
  unit_offerings_normalize_readiness_stage
on public.unit_offerings;

-- PostgreSQL runs triggers for the same event in name order. "normalize"
-- sorts before the existing "validate" trigger, so the corrected origin is
-- available to the normal relationship checks.
create trigger
  unit_offerings_normalize_readiness_stage
before insert or update
on public.unit_offerings
for each row
execute function
  public.normalize_readiness_bulk_unit_offering_stage();

comment on function
  public.normalize_readiness_bulk_unit_offering_stage() is
  'Classifies cross-stage readiness imports as audited legacy offerings before curriculum validation.';
