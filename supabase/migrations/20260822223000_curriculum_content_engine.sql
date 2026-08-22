-- ============================================================
-- Academic Planner — Curriculum Content Engine V1
-- Separates official unit identity from reusable curriculum content.
-- ============================================================

create table if not exists public.curriculum_families (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  family_key text not null,
  name text not null,
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (status in ('draft','review','approved','retired')),
  unit_description text,
  overall_competency text,
  teaching_learning_approaches text,
  assessment_approaches text,
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, family_key, version)
);

create table if not exists public.curriculum_unit_mappings (
  id uuid primary key default gen_random_uuid(),
  curriculum_family_id uuid not null references public.curriculum_families(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  is_primary boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (unit_id)
);

create table if not exists public.curriculum_learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  curriculum_family_id uuid not null references public.curriculum_families(id) on delete cascade,
  sequence integer not null check (sequence >= 1),
  learning_outcome text not null,
  unique (curriculum_family_id, sequence)
);

create table if not exists public.curriculum_weeks (
  id uuid primary key default gen_random_uuid(),
  curriculum_family_id uuid not null references public.curriculum_families(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 14),
  topic text not null,
  specific_coverage text,
  learning_outcomes text,
  teaching_learning_activities text,
  assessment_learning_check text,
  resources text,
  unique (curriculum_family_id, week_number)
);

create table if not exists public.curriculum_references (
  id uuid primary key default gen_random_uuid(),
  curriculum_family_id uuid not null references public.curriculum_families(id) on delete cascade,
  sequence integer not null check (sequence >= 1),
  reference_resource text not null,
  unique (curriculum_family_id, sequence)
);

create table if not exists public.curriculum_content_import_batches (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  original_file_name text not null,
  template_version text not null,
  status text not null default 'validated' check (status in ('validated','importing','completed','failed')),
  payload jsonb not null,
  validation_summary jsonb not null default '{}'::jsonb,
  failure_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  imported_at timestamptz
);

create index if not exists curriculum_unit_mappings_family_idx
  on public.curriculum_unit_mappings(curriculum_family_id);
create index if not exists curriculum_weeks_family_idx
  on public.curriculum_weeks(curriculum_family_id, week_number);
create index if not exists curriculum_outcomes_family_idx
  on public.curriculum_learning_outcomes(curriculum_family_id, sequence);

alter table public.curriculum_families enable row level security;
alter table public.curriculum_unit_mappings enable row level security;
alter table public.curriculum_learning_outcomes enable row level security;
alter table public.curriculum_weeks enable row level security;
alter table public.curriculum_references enable row level security;
alter table public.curriculum_content_import_batches enable row level security;

-- Read access is intentionally broad for authenticated users because trainers
-- need curriculum for allocated units. Mutations remain HOD-controlled via RPC.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='curriculum_families' and policyname='curriculum_families_read') then
    create policy curriculum_families_read on public.curriculum_families for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='curriculum_unit_mappings' and policyname='curriculum_unit_mappings_read') then
    create policy curriculum_unit_mappings_read on public.curriculum_unit_mappings for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='curriculum_learning_outcomes' and policyname='curriculum_outcomes_read') then
    create policy curriculum_outcomes_read on public.curriculum_learning_outcomes for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='curriculum_weeks' and policyname='curriculum_weeks_read') then
    create policy curriculum_weeks_read on public.curriculum_weeks for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='curriculum_references' and policyname='curriculum_references_read') then
    create policy curriculum_references_read on public.curriculum_references for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='curriculum_content_import_batches' and policyname='curriculum_content_import_batches_owner_read') then
    create policy curriculum_content_import_batches_owner_read on public.curriculum_content_import_batches
      for select to authenticated
      using (created_by = auth.uid() and public.current_user_can_manage_department(department_id));
  end if;
end $$;


drop policy if exists curriculum_content_import_batches_owner_insert on public.curriculum_content_import_batches;
create policy curriculum_content_import_batches_owner_insert
on public.curriculum_content_import_batches
for insert to authenticated
with check (created_by = auth.uid() and public.current_user_can_manage_department(department_id));

create or replace function public.import_curriculum_content_batch(target_batch_id uuid)
returns table (
  batch_id uuid,
  families_imported integer,
  unit_mappings_imported integer,
  weeks_imported integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_batch public.curriculum_content_import_batches%rowtype;
  family_payload jsonb;
  mapping_payload jsonb;
  outcome_payload jsonb;
  week_payload jsonb;
  reference_payload jsonb;
  family_id_value uuid;
  family_total integer := 0;
  mapping_total integer := 0;
  week_total integer := 0;
begin
  select * into selected_batch
  from public.curriculum_content_import_batches
  where id = target_batch_id
  for update;

  if selected_batch.id is null then
    raise exception using errcode='P0002', message='Curriculum content import batch not found';
  end if;
  if selected_batch.status <> 'validated' then
    raise exception using errcode='P0001', message='Only validated curriculum content batches can be imported';
  end if;
  if not public.current_user_can_manage_department(selected_batch.department_id) then
    raise exception using errcode='42501', message='Not permitted to import curriculum content for this department';
  end if;

  update public.curriculum_content_import_batches
  set status='importing', failure_message=null
  where id=target_batch_id;

  for family_payload in
    select value from jsonb_array_elements(selected_batch.payload -> 'families')
  loop
    insert into public.curriculum_families (
      department_id, family_key, name, version, status,
      unit_description, overall_competency,
      teaching_learning_approaches, assessment_approaches,
      approved_at, approved_by, created_by, updated_at
    ) values (
      selected_batch.department_id,
      family_payload ->> 'familyKey',
      family_payload ->> 'familyName',
      coalesce((family_payload ->> 'version')::integer, 1),
      'approved',
      nullif(family_payload ->> 'unitDescription',''),
      nullif(family_payload ->> 'overallCompetency',''),
      nullif(family_payload ->> 'teachingLearningApproaches',''),
      nullif(family_payload ->> 'assessmentApproaches',''),
      now(), auth.uid(), auth.uid(), now()
    )
    on conflict (department_id, family_key, version)
    do update set
      name=excluded.name,
      unit_description=excluded.unit_description,
      overall_competency=excluded.overall_competency,
      teaching_learning_approaches=excluded.teaching_learning_approaches,
      assessment_approaches=excluded.assessment_approaches,
      status='approved',
      approved_at=now(),
      approved_by=auth.uid(),
      updated_at=now()
    returning id into family_id_value;

    delete from public.curriculum_learning_outcomes where curriculum_family_id=family_id_value;
    delete from public.curriculum_weeks where curriculum_family_id=family_id_value;
    delete from public.curriculum_references where curriculum_family_id=family_id_value;

    for outcome_payload in select value from jsonb_array_elements(coalesce(family_payload -> 'learningOutcomes','[]'::jsonb)) loop
      insert into public.curriculum_learning_outcomes(curriculum_family_id,sequence,learning_outcome)
      values(family_id_value,(outcome_payload ->> 'sequence')::integer,outcome_payload ->> 'text');
    end loop;

    for week_payload in select value from jsonb_array_elements(family_payload -> 'weeks') loop
      insert into public.curriculum_weeks(
        curriculum_family_id,week_number,topic,specific_coverage,learning_outcomes,
        teaching_learning_activities,assessment_learning_check,resources
      ) values (
        family_id_value,
        (week_payload ->> 'weekNumber')::integer,
        week_payload ->> 'topic',
        nullif(week_payload ->> 'specificCoverage',''),
        nullif(week_payload ->> 'learningOutcomes',''),
        nullif(week_payload ->> 'teachingLearningActivities',''),
        nullif(week_payload ->> 'assessmentLearningCheck',''),
        nullif(week_payload ->> 'resources','')
      );
      week_total := week_total + 1;
    end loop;

    for reference_payload in select value from jsonb_array_elements(coalesce(family_payload -> 'references','[]'::jsonb)) loop
      insert into public.curriculum_references(curriculum_family_id,sequence,reference_resource)
      values(family_id_value,(reference_payload ->> 'sequence')::integer,reference_payload ->> 'text');
    end loop;

    for mapping_payload in select value from jsonb_array_elements(family_payload -> 'unitMappings') loop
      delete from public.curriculum_unit_mappings where unit_id=(mapping_payload ->> 'unitId')::uuid;
      insert into public.curriculum_unit_mappings(curriculum_family_id,unit_id,is_primary,created_by)
      values(family_id_value,(mapping_payload ->> 'unitId')::uuid,coalesce((mapping_payload ->> 'isPrimary')::boolean,false),auth.uid());
      mapping_total := mapping_total + 1;
    end loop;

    family_total := family_total + 1;
  end loop;

  update public.curriculum_content_import_batches
  set status='completed', imported_at=now(), failure_message=null
  where id=target_batch_id;

  return query select target_batch_id,family_total,mapping_total,week_total;
exception when others then
  update public.curriculum_content_import_batches
  set status='failed', failure_message=sqlerrm
  where id=target_batch_id;
  raise;
end;
$$;

revoke all on function public.import_curriculum_content_batch(uuid) from public, anon;
grant execute on function public.import_curriculum_content_batch(uuid) to authenticated;

comment on table public.curriculum_families is 'Versioned reusable curriculum content families. Multiple official units may share one family.';
comment on table public.curriculum_weeks is 'Exactly 14 teaching-content weeks per curriculum family. Assessment calendar events do not belong here.';
