-- Standardize the CND and DND Applied Physical Sciences II titles and treat
-- the former singular wording as the same shared curriculum unit.

update public.units
set
  name = 'Applied Physical Sciences II (Physics)',
  updated_at = now()
where trim(lower(regexp_replace(trim(name), '[^a-z0-9]+', ' ', 'gi'))) in (
  'applied physical science ii physics',
  'applied physical sciences ii physics'
)
and name <> 'Applied Physical Sciences II (Physics)';

update public.teaching_offerings
set
  title = 'Applied Physical Sciences II (Physics)',
  updated_at = now()
where trim(lower(regexp_replace(trim(title), '[^a-z0-9]+', ' ', 'gi'))) in (
  'applied physical science ii physics',
  'applied physical sciences ii physics'
)
and title <> 'Applied Physical Sciences II (Physics)';

create or replace function public.canonical_shared_unit_title(
  p_title text
)
returns text
language plpgsql
immutable
strict
parallel safe
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := trim(
    regexp_replace(
      replace(
        replace(
          replace(
            lower(regexp_replace(trim(p_title), '[^a-z0-9]+', ' ', 'gi')),
            'lifespan',
            'life cycle'
          ),
          'lifecycle',
          'life cycle'
        ),
        'life span',
        'life cycle'
      ),
      '\s+',
      ' ',
      'g'
    )
  );

  if normalized in ('diet therapy 1', 'diet therapy i') then
    return 'diet therapy';
  end if;

  if normalized = 'diet therapy iii theory' then
    return 'diet therapy iii';
  end if;

  if normalized =
    'introduction to nutrition assessment and surveillance' then
    return 'nutrition assessment and surveillance';
  end if;

  if normalized = 'applied physical science ii physics' then
    return 'applied physical sciences ii physics';
  end if;

  return normalized;
end;
$$;

comment on function public.canonical_shared_unit_title(text) is
  'Canonicalizes approved shared-unit equivalents, including singular/plural Applied Physical Sciences II (Physics).';
