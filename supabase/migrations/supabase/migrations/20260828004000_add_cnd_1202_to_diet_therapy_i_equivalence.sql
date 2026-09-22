-- Complete the approved Diet Therapy I equivalence by adding CND 1202 to the
-- existing department-scoped canonical group. Preserve the unit's identity.

do $$
declare
  target_unit_id uuid;
  target_department_id uuid;
  target_group_id uuid;
  current_group_id uuid;
begin
  select unit_record.id, programme.department_id
  into target_unit_id, target_department_id
  from public.units unit_record
  join public.programmes programme on programme.id = unit_record.programme_id
  where upper(trim(unit_record.code)) = 'CND 1202';

  if target_unit_id is null then
    raise exception 'Unit CND 1202 was not found';
  end if;

  select equivalence_group.id
  into target_group_id
  from public.unit_equivalence_groups equivalence_group
  where equivalence_group.department_id = target_department_id
    and equivalence_group.canonical_key = public.canonical_unit_name('Diet Therapy I');

  if target_group_id is null then
    raise exception 'The approved Diet Therapy I equivalence group was not found';
  end if;

  select member.equivalence_group_id
  into current_group_id
  from public.unit_equivalence_members member
  where member.unit_id = target_unit_id;

  if current_group_id is not null and current_group_id <> target_group_id then
    raise exception 'CND 1202 already belongs to a different equivalence group';
  end if;

  update public.units
  set name = 'Diet Therapy I', updated_at = now()
  where id = target_unit_id
    and name is distinct from 'Diet Therapy I';

  if current_group_id is null then
    insert into public.unit_equivalence_members
      (equivalence_group_id, unit_id, approved_by, notes)
    select target_group_id, target_unit_id, equivalence_group.approved_by,
      'Aligned with the approved Diet Therapy I canonical subject'
    from public.unit_equivalence_groups equivalence_group
    where equivalence_group.id = target_group_id;
  end if;
end;
$$;
