-- Treat the introductory and standard Nutrition Assessment and Surveillance
-- titles as one curriculum subject for shared-class confirmation.

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

  return normalized;
end;
$$;

comment on function public.canonical_shared_unit_title(text) is
  'Canonicalizes approved shared-unit equivalents, including introductory Nutrition Assessment and Surveillance.';
