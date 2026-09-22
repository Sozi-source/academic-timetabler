-- Make an explicitly approved cohort-period Unit on Offer the sole authority
-- for allocation and scheduling.  Unit-name similarity only proposes durable
-- academic equivalence; it never authorizes or merges delivery by itself.

create extension if not exists pg_trgm with schema extensions;

do $$ begin
  create type public.unit_offering_approval_status as enum (
    'review_required', 'approved', 'withdrawn'
  );
exception when duplicate_object then null;
end $$;

alter table public.unit_offerings
  add column if not exists approval_status
    public.unit_offering_approval_status not null default 'review_required',
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists withdrawn_by uuid references auth.users(id),
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawal_reason text;

alter table public.unit_offerings drop constraint if exists unit_offerings_approval_metadata_check;
alter table public.unit_offerings add constraint unit_offerings_approval_metadata_check check (
  (approval_status = 'approved' and approved_by is not null and approved_at is not null
    and withdrawn_by is null and withdrawn_at is null)
  or (approval_status = 'withdrawn' and withdrawn_by is not null and withdrawn_at is not null
    and nullif(trim(withdrawal_reason), '') is not null)
  or (approval_status = 'review_required' and approved_by is null and approved_at is null
    and withdrawn_by is null and withdrawn_at is null)
);

create index if not exists unit_offerings_authorization_idx
  on public.unit_offerings (academic_period_id, cohort_id, approval_status)
  where approval_status = 'approved';

-- Deliberately do not grandfather existing rows.  They are discoverable in the
-- audit below and must be reviewed once before they can feed a new timetable.
update public.unit_offerings
set approval_status = 'review_required', approved_by = null, approved_at = null,
    withdrawn_by = null, withdrawn_at = null, withdrawal_reason = null
where approval_status <> 'review_required';

create table if not exists public.unit_equivalence_groups (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  canonical_key text not null,
  department_id uuid references public.departments(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'retired')),
  notes text,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (department_id, canonical_key)
);

create table if not exists public.unit_equivalence_members (
  equivalence_group_id uuid not null references public.unit_equivalence_groups(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete restrict,
  status text not null default 'approved' check (status in ('approved', 'excluded')),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  notes text,
  primary key (equivalence_group_id, unit_id),
  unique (unit_id)
);

alter table public.unit_equivalence_groups enable row level security;
alter table public.unit_equivalence_members enable row level security;

drop policy if exists unit_equivalence_groups_select on public.unit_equivalence_groups;
create policy unit_equivalence_groups_select on public.unit_equivalence_groups
for select to authenticated using (
  department_id is null or public.current_user_can_access_department(department_id)
);
drop policy if exists unit_equivalence_members_select on public.unit_equivalence_members;
create policy unit_equivalence_members_select on public.unit_equivalence_members
for select to authenticated using (exists (
  select 1 from public.unit_equivalence_groups g
  where g.id = equivalence_group_id
    and (g.department_id is null or public.current_user_can_access_department(g.department_id))
));

create or replace function public.canonical_unit_name(value text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select trim(regexp_replace(
    regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'
  ));
$$;

create or replace function public.set_unit_offering_approval(
  p_offering_ids uuid[], p_approve boolean, p_reason text default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  changed integer;
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501', message = 'Select an authorized working department';
  end if;
  if coalesce(cardinality(p_offering_ids), 0) = 0 then
    raise exception 'Select at least one Unit on Offer';
  end if;
  if not p_approve and nullif(trim(p_reason), '') is null then
    raise exception 'Provide a reason when withdrawing an offering';
  end if;

  update public.unit_offerings offering set
    approval_status = case when p_approve
      then 'approved'::public.unit_offering_approval_status
      else 'withdrawn'::public.unit_offering_approval_status end,
    selection_state = case when p_approve
      then 'included'::public.unit_offering_selection_state
      else 'excluded'::public.unit_offering_selection_state end,
    status = case when p_approve
      then 'draft'::public.unit_offering_status
      else 'cancelled'::public.unit_offering_status end,
    is_timetable_enabled = p_approve and offering.offering_type not in
      ('attachment', 'clinical_rotation', 'examination'),
    approved_by = case when p_approve then auth.uid() else null end,
    approved_at = case when p_approve then now() else null end,
    withdrawn_by = case when p_approve then null else auth.uid() end,
    withdrawn_at = case when p_approve then null else now() end,
    withdrawal_reason = case when p_approve then null else trim(p_reason) end,
    manually_reviewed = true, reviewed_by = auth.uid(), reviewed_at = now(),
    updated_by = auth.uid(), updated_at = now()
  from public.cohorts cohort
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.id = any(p_offering_ids)
    and offering.cohort_id = cohort.id
    and programme.department_id = active_department
    and not exists (
      select 1 from public.scheduled_sessions session
      join public.teaching_allocations allocation
        on allocation.id = session.teaching_allocation_id
      where allocation.source_unit_offering_id = offering.id
        and (session.is_locked or session.status = 'locked')
        and not p_approve
    );
  get diagnostics changed = row_count;
  if changed <> cardinality(p_offering_ids) then
    raise exception 'Some offerings were unavailable, outside the working department, or have locked sessions';
  end if;

  if p_approve then
    -- Reconcile deterministic legacy allocations only after human approval.
    -- Ambiguous or mismatched records remain visible in the audit view.
    update public.teaching_allocations allocation
    set source_unit_offering_id = offering.id,
        updated_by = auth.uid(), updated_at = now()
    from public.unit_offerings offering
    where offering.id = any(p_offering_ids)
      and allocation.source_unit_offering_id is null
      and allocation.academic_period_id = offering.academic_period_id
      and allocation.cohort_id = offering.cohort_id
      and allocation.unit_id = offering.unit_id
      and (
        allocation.teaching_offering_id is null
        or exists (
          select 1 from public.teaching_offering_participants participant
          where participant.teaching_offering_id = allocation.teaching_offering_id
            and participant.unit_offering_id = offering.id
        )
      );
  else
    update public.teaching_allocations allocation
    set is_timetable_enabled = false, status = 'suspended', updated_by = auth.uid(), updated_at = now()
    where allocation.source_unit_offering_id = any(p_offering_ids)
      and allocation.status in ('draft', 'active');
  end if;
  return changed;
end;
$$;

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
    set canonical_name = excluded.canonical_name, notes = coalesce(excluded.notes, public.unit_equivalence_groups.notes),
        status = 'active', updated_at = now()
  returning id into group_id;

  insert into public.unit_equivalence_members (equivalence_group_id, unit_id, approved_by)
  select group_id, unit_id, auth.uid() from unnest(p_unit_ids) unit_id;

  -- Standardize the approved display title while preserving IDs and codes.
  update public.units set name = trim(p_canonical_name), updated_by = auth.uid(), updated_at = now()
  where id = any(p_unit_ids);
  return group_id;
end;
$$;

create or replace function public.get_unit_equivalence_candidates()
returns table (
  unit_id uuid, unit_code text, unit_name text, programme_id uuid,
  programme_code text, programme_name text, canonical_name text,
  exact_group_size bigint, nearest_unit_id uuid, nearest_unit_name text,
  similarity_score real, equivalence_group_id uuid
) language sql stable security definer set search_path = '' as $$
  with scoped as (
    select u.id, u.code, u.name, u.programme_id, p.code programme_code,
      p.name programme_name, public.canonical_unit_name(u.name) canonical_name
    from public.units u join public.programmes p on p.id = u.programme_id
    where p.department_id = public.current_user_primary_department_id() and u.is_active
  ), compared as (
    select a.*, count(*) over (partition by a.canonical_name) exact_group_size,
      nearest.id nearest_unit_id, nearest.name nearest_unit_name,
      extensions.similarity(a.canonical_name, nearest.canonical_name) similarity_score
    from scoped a
    left join lateral (
      select b.* from scoped b where b.id <> a.id
      order by extensions.similarity(a.canonical_name, b.canonical_name) desc, b.id limit 1
    ) nearest on true
  )
  select c.id, c.code, c.name, c.programme_id, c.programme_code, c.programme_name,
    c.canonical_name, c.exact_group_size, c.nearest_unit_id, c.nearest_unit_name,
    coalesce(c.similarity_score, 0), m.equivalence_group_id
  from compared c left join public.unit_equivalence_members m on m.unit_id = c.id
  where c.exact_group_size > 1 or coalesce(c.similarity_score, 0) >= 0.45
  order by c.exact_group_size desc, c.canonical_name, c.programme_code, c.code;
$$;

create or replace function public.enforce_allocation_offering_authority()
returns trigger language plpgsql security definer set search_path = '' as $$
declare source public.unit_offerings%rowtype;
begin
  if not new.is_timetable_enabled or new.status not in ('draft', 'active') then return new; end if;
  if new.source_unit_offering_id is null then
    raise exception 'A timetable-enabled allocation requires an approved source Unit on Offer';
  end if;
  select * into source from public.unit_offerings where id = new.source_unit_offering_id;
  if source.id is null or source.approval_status <> 'approved'
    or not source.is_timetable_enabled or source.selection_state <> 'included'
    or source.status not in ('draft', 'active') then
    raise exception 'The source Unit on Offer is not approved for timetabling';
  end if;
  if source.academic_period_id <> new.academic_period_id then
    raise exception 'Allocation and source offering Academic Periods do not match';
  end if;
  if new.teaching_offering_id is null
    and (source.cohort_id <> new.cohort_id or source.unit_id <> new.unit_id) then
    raise exception 'Allocation cohort/unit does not match its source offering';
  end if;
  if new.teaching_offering_id is not null and exists (
    select 1 from public.teaching_offering_participants participant
    left join public.unit_offerings member on member.id = participant.unit_offering_id
    where participant.teaching_offering_id = new.teaching_offering_id
      and (member.id is null or member.approval_status <> 'approved'
        or not member.is_timetable_enabled or member.selection_state <> 'included')
  ) then raise exception 'Every shared-class participant must be an approved Unit on Offer'; end if;
  return new;
end;
$$;

drop trigger if exists teaching_allocations_enforce_offering_authority on public.teaching_allocations;
drop trigger if exists zz_teaching_allocations_enforce_offering_authority on public.teaching_allocations;
-- PostgreSQL fires same-kind triggers alphabetically.  Run after the existing
-- fixed-session context trigger, which resolves the exact source offering.
create trigger zz_teaching_allocations_enforce_offering_authority
before insert or update of source_unit_offering_id, teaching_offering_id, academic_period_id,
  cohort_id, unit_id, status, is_timetable_enabled on public.teaching_allocations
for each row execute function public.enforce_allocation_offering_authority();

create or replace function public.enforce_session_offering_authority()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status not in ('draft', 'confirmed', 'locked') then return new; end if;
  if not exists (
    select 1 from public.teaching_allocations allocation
    join public.unit_offerings offering on offering.id = allocation.source_unit_offering_id
    where allocation.id = new.teaching_allocation_id
      and allocation.is_timetable_enabled and allocation.status in ('draft', 'active')
      and offering.approval_status = 'approved' and offering.is_timetable_enabled
      and offering.selection_state = 'included'
  ) then raise exception 'A session requires an allocation backed by an approved Unit on Offer'; end if;
  return new;
end;
$$;

drop trigger if exists scheduled_sessions_enforce_offering_authority on public.scheduled_sessions;
create trigger scheduled_sessions_enforce_offering_authority
before insert or update of teaching_allocation_id, status on public.scheduled_sessions
for each row execute function public.enforce_session_offering_authority();

create or replace function public.enforce_shared_participant_equivalence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare selected_group uuid; existing_group uuid; selected_offering public.unit_offerings%rowtype;
begin
  if new.unit_offering_id is null then
    raise exception 'A shared-class participant requires an exact Unit on Offer identity';
  end if;
  select * into selected_offering from public.unit_offerings where id = new.unit_offering_id;
  if selected_offering.id is null or selected_offering.cohort_id <> new.cohort_id
    or selected_offering.unit_id <> new.unit_id or selected_offering.approval_status <> 'approved'
    or not selected_offering.is_timetable_enabled then
    raise exception 'Every shared-class participant must be an approved matching Unit on Offer';
  end if;
  select equivalence_group_id into selected_group from public.unit_equivalence_members
  where unit_id = new.unit_id and status = 'approved';
  if selected_group is null then raise exception 'Approve academic unit equivalence before combining a shared class'; end if;
  select member.equivalence_group_id into existing_group
  from public.teaching_offering_participants participant
  join public.unit_equivalence_members member on member.unit_id = participant.unit_id and member.status = 'approved'
  where participant.teaching_offering_id = new.teaching_offering_id limit 1;
  if existing_group is not null and existing_group <> selected_group then
    raise exception 'Shared-class participants must belong to the same approved equivalence group';
  end if;
  return new;
end;
$$;

drop trigger if exists teaching_participants_enforce_equivalence on public.teaching_offering_participants;
create trigger teaching_participants_enforce_equivalence
before insert or update of teaching_offering_id, cohort_id, unit_id, unit_offering_id
on public.teaching_offering_participants for each row
execute function public.enforce_shared_participant_equivalence();

create or replace function public.enforce_timetable_publication_authority()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status not in ('approved', 'published') then return new; end if;
  if exists (
    select 1 from jsonb_array_elements(new.snapshot) snapshot
    left join public.scheduled_sessions session on session.id = (snapshot ->> 'id')::uuid
    left join public.teaching_allocations allocation on allocation.id = session.teaching_allocation_id
    left join public.unit_offerings offering on offering.id = allocation.source_unit_offering_id
    where session.id is null or allocation.id is null or offering.id is null or offering.approval_status <> 'approved'
        or offering.selection_state <> 'included' or not offering.is_timetable_enabled)
  then raise exception 'Timetable approval/publication blocked: every session must trace to an approved Unit on Offer'; end if;
  return new;
end;
$$;

drop trigger if exists timetable_versions_enforce_offering_authority on public.timetable_versions;
create trigger timetable_versions_enforce_offering_authority
before update of status on public.timetable_versions for each row
execute function public.enforce_timetable_publication_authority();

create or replace view public.timetable_offering_authorization_audit
with (security_invoker = true) as
select allocation.id allocation_id, allocation.academic_period_id,
  allocation.cohort_id, allocation.unit_id, allocation.source_unit_offering_id,
  allocation.is_timetable_enabled allocation_enabled, allocation.status allocation_status,
  offering.approval_status, offering.selection_state,
  offering.is_timetable_enabled offering_enabled,
  case
    when allocation.source_unit_offering_id is null then 'missing_source_offering'
    when offering.id is null then 'source_offering_not_found'
    when offering.academic_period_id <> allocation.academic_period_id then 'period_mismatch'
    when allocation.teaching_offering_id is null and
      (offering.cohort_id <> allocation.cohort_id or offering.unit_id <> allocation.unit_id) then 'cohort_or_unit_mismatch'
    when offering.approval_status <> 'approved' then 'offering_not_approved'
    when offering.selection_state <> 'included' or not offering.is_timetable_enabled then 'offering_not_enabled'
    else 'authorized'
  end finding
from public.teaching_allocations allocation
left join public.unit_offerings offering on offering.id = allocation.source_unit_offering_id;

revoke all on function public.set_unit_offering_approval(uuid[], boolean, text) from public;
grant execute on function public.set_unit_offering_approval(uuid[], boolean, text) to authenticated;
revoke all on function public.approve_unit_equivalence_group(uuid[], text, text) from public;
grant execute on function public.approve_unit_equivalence_group(uuid[], text, text) to authenticated;
revoke all on function public.get_unit_equivalence_candidates() from public;
grant execute on function public.get_unit_equivalence_candidates() to authenticated;
grant select on public.timetable_offering_authorization_audit to authenticated;

comment on table public.unit_equivalence_groups is
  'Reviewed canonical academic subjects; similarity alone never creates membership.';
comment on column public.unit_offerings.approval_status is
  'Explicit cohort-period authorization boundary for allocation and scheduling.';
