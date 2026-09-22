-- Keep smart trainer exchanges inside the active department and preserve
-- explicit unit qualification rules at the database boundary.

create or replace function public.enforce_trainer_exchange_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.trainer_unit_eligibility eligibility
    where eligibility.unit_id = new.unit_id
  ) and not exists (
    select 1
    from public.trainer_unit_eligibility eligibility
    where eligibility.unit_id = new.unit_id
      and eligibility.trainer_id = new.trainer_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'The selected trainer is not qualified for this unit';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_trainer_exchange_eligibility
  on public.teaching_allocations;

create constraint trigger guard_trainer_exchange_eligibility
after update of trainer_id on public.teaching_allocations
deferrable initially immediate
for each row
when (new.trainer_id is not null and old.trainer_id is distinct from new.trainer_id)
execute function public.enforce_trainer_exchange_eligibility();

comment on function public.enforce_trainer_exchange_eligibility() is
  'Prevents trainer reassignment, including smart exchanges, from violating explicit unit qualification rules.';
