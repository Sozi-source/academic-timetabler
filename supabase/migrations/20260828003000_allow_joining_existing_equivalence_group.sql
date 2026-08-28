-- A previously approved canonical group can gain one newly reviewed member.
-- Creating a new canonical group still requires at least two units.

create or replace function public.approve_unit_equivalence_group(
  p_unit_ids uuid[], p_canonical_name text, p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  group_id uuid;
  existing_group_id uuid;
  member_count integer;
  normalized_canonical_key text := public.canonical_unit_name(p_canonical_name);
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501', message = 'Select an authorized working department';
  end if;
  if coalesce(cardinality(p_unit_ids), 0) = 0 or normalized_canonical_key = '' then
    raise exception 'Select at least one unit and provide a canonical name';
  end if;

  select equivalence_group.id into existing_group_id
  from public.unit_equivalence_groups equivalence_group
  where equivalence_group.department_id = active_department
    and equivalence_group.canonical_key = normalized_canonical_key;
  if existing_group_id is null and cardinality(p_unit_ids) < 2 then
    raise exception 'Select at least two units when creating a new equivalence group';
  end if;

  select count(distinct unit_record.id) into member_count
  from public.units unit_record
  join public.programmes programme on programme.id = unit_record.programme_id
  where unit_record.id = any(p_unit_ids) and programme.department_id = active_department;
  if member_count <> cardinality(p_unit_ids) then
    raise exception 'Every unit must belong to the working department';
  end if;
  if exists (select 1 from public.unit_equivalence_members where unit_id = any(p_unit_ids)) then
    raise exception 'One or more units already belong to an equivalence group';
  end if;

  insert into public.unit_equivalence_groups
    (canonical_name, canonical_key, department_id, notes, approved_by)
  values (trim(p_canonical_name), normalized_canonical_key, active_department, nullif(trim(p_notes), ''), auth.uid())
  on conflict (department_id, canonical_key) do update
    set canonical_name = excluded.canonical_name,
        notes = coalesce(excluded.notes, public.unit_equivalence_groups.notes),
        status = 'active', updated_at = now()
  returning id into group_id;

  insert into public.unit_equivalence_members (equivalence_group_id, unit_id, approved_by)
  select group_id, unit_id, auth.uid() from unnest(p_unit_ids) unit_id;

  update public.units
  set name = trim(p_canonical_name), updated_by = auth.uid(), updated_at = now()
  where id = any(p_unit_ids);
  return group_id;
end;
$$;
