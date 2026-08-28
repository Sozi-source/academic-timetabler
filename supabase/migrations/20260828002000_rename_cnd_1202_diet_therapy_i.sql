-- Align the Certificate Diet Therapy title with the approved Diploma wording.
-- The unit code and every relationship remain unchanged.

do $$
declare
  matching_units integer;
begin
  select count(*)
  into matching_units
  from public.units
  where upper(trim(code)) = 'CND 1202';

  if matching_units > 1 then
    raise exception 'Expected at most one unit with code CND 1202, found %', matching_units;
  end if;

  update public.units
  set name = 'Diet Therapy I',
      updated_at = now()
  where upper(trim(code)) = 'CND 1202'
    and name is distinct from 'Diet Therapy I';
end;
$$;
