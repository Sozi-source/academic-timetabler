-- Standardize the approved Diet Therapy curriculum wording and extend the
-- shared-class canonicalizer with the institution-approved equivalents.

update public.units
set name = 'Diet Therapy III'
where lower(regexp_replace(trim(name), '[^a-z0-9]+', ' ', 'gi')) =
  'diet therapy iii theory';

update public.teaching_offerings
set title = 'Diet Therapy III'
where lower(regexp_replace(trim(title), '[^a-z0-9]+', ' ', 'gi')) =
  'diet therapy iii theory';

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

  return normalized;
end;
$$;

comment on function public.canonical_shared_unit_title(text) is
  'Canonicalizes approved equivalents including Lifespan/Lifecycle, Diet Therapy/Diet Therapy 1, and the former Diet Therapy III Theory title.';
