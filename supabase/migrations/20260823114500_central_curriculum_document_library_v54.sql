-- ============================================================
-- Academic Planner — Central Curriculum Document Library V5.4.0
-- Bridges existing Curriculum Import batches into a permanent,
-- versioned unit-level Course Outline / Scheme of Work library.
-- ============================================================

-- V5 uses "imported". Older curriculum migrations used "completed".
alter table public.curriculum_content_import_batches
  drop constraint if exists curriculum_content_import_batches_status_check;

alter table public.curriculum_content_import_batches
  add constraint curriculum_content_import_batches_status_check
  check (
    status in (
      'validated',
      'importing',
      'completed',
      'failed',
      'imported'
    )
  );

create table if not exists public.curriculum_document_versions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete cascade,
  document_type text not null
    check (document_type in ('course_outline','scheme_of_work')),
  version_number integer not null
    check (version_number >= 1),
  status text not null default 'active'
    check (status in ('active','superseded','retired')),
  source_type text not null default 'admin_import'
    check (source_type in ('admin_import','legacy_import','trainer_upload')),
  source_import_batch_id uuid
    references public.curriculum_content_import_batches(id)
    on delete set null,
  source_file_name text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz,
  retired_at timestamptz,
  unique (unit_id, document_type, version_number)
);

create unique index if not exists curriculum_document_versions_one_active
  on public.curriculum_document_versions(unit_id, document_type)
  where status = 'active';

create index if not exists curriculum_document_versions_unit_idx
  on public.curriculum_document_versions(unit_id, document_type, created_at desc);

create index if not exists curriculum_document_versions_department_idx
  on public.curriculum_document_versions(department_id, status, document_type);

create index if not exists curriculum_document_versions_batch_idx
  on public.curriculum_document_versions(source_import_batch_id);

alter table public.curriculum_document_versions enable row level security;

drop policy if exists curriculum_document_versions_read
  on public.curriculum_document_versions;

create policy curriculum_document_versions_read
  on public.curriculum_document_versions
  for select
  to authenticated
  using (true);

drop policy if exists curriculum_document_versions_manage
  on public.curriculum_document_versions;

create policy curriculum_document_versions_manage
  on public.curriculum_document_versions
  for all
  to authenticated
  using (
    department_id is not null
    and public.current_user_can_manage_department(department_id)
  )
  with check (
    department_id is not null
    and public.current_user_can_manage_department(department_id)
  );

-- Internal idempotent version creator.
create or replace function public._create_curriculum_document_version_v54(
  target_department_id uuid,
  target_unit_id uuid,
  target_document_type text,
  target_source_type text,
  target_source_import_batch_id uuid,
  target_source_file_name text,
  target_payload jsonb,
  target_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
  next_version integer;
  inserted_id uuid;
begin
  if target_document_type not in ('course_outline','scheme_of_work') then
    raise exception using
      errcode='P0001',
      message='Unsupported curriculum document type';
  end if;

  if target_source_import_batch_id is not null then
    select id
      into existing_id
    from public.curriculum_document_versions
    where source_import_batch_id = target_source_import_batch_id
      and unit_id = target_unit_id
      and document_type = target_document_type
    order by version_number desc
    limit 1;

    if existing_id is not null then
      return existing_id;
    end if;
  end if;

  update public.curriculum_document_versions
  set
    status = 'superseded',
    superseded_at = now(),
    updated_at = now()
  where unit_id = target_unit_id
    and document_type = target_document_type
    and status = 'active';

  select coalesce(max(version_number), 0) + 1
    into next_version
  from public.curriculum_document_versions
  where unit_id = target_unit_id
    and document_type = target_document_type;

  insert into public.curriculum_document_versions (
    department_id,
    unit_id,
    document_type,
    version_number,
    status,
    source_type,
    source_import_batch_id,
    source_file_name,
    payload,
    created_by
  )
  values (
    target_department_id,
    target_unit_id,
    target_document_type,
    next_version,
    'active',
    target_source_type,
    target_source_import_batch_id,
    target_source_file_name,
    coalesce(target_payload, '{}'::jsonb),
    target_created_by
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public._create_curriculum_document_version_v54(
  uuid,uuid,text,text,uuid,text,jsonb,uuid
) from public, anon, authenticated;

-- Publish either a V5 payload ("units"/"content") or an older
-- curriculum payload ("families"/"unitMappings") into the same library.
create or replace function public.publish_curriculum_import_batch_to_library(
  target_batch_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_batch public.curriculum_content_import_batches%rowtype;
  unit_payload jsonb;
  content_payload jsonb;
  family_payload jsonb;
  mapping_payload jsonb;
  normalized_payload jsonb;
  document_type_value text;
  source_unit_key text;
  matched_unit_id uuid;
  mapped_unit_id uuid;
  mapped_unit_code text;
  mapped_unit_name text;
  published_count integer := 0;
begin
  select *
    into selected_batch
  from public.curriculum_content_import_batches
  where id = target_batch_id;

  if selected_batch.id is null then
    raise exception using
      errcode='P0002',
      message='Curriculum import batch not found';
  end if;

  if auth.uid() is not null
     and not public.current_user_can_manage_department(selected_batch.department_id)
  then
    raise exception using
      errcode='42501',
      message='Not permitted to publish this curriculum batch';
  end if;

  -- ----------------------------------------------------------
  -- Curriculum Import V5 payload
  -- ----------------------------------------------------------
  if jsonb_typeof(selected_batch.payload -> 'units') = 'array' then
    for unit_payload in
      select value
      from jsonb_array_elements(selected_batch.payload -> 'units')
    loop
      if nullif(unit_payload ->> 'matchedUnitId','') is null then
        continue;
      end if;

      begin
        matched_unit_id := (unit_payload ->> 'matchedUnitId')::uuid;
      exception when others then
        continue;
      end;

      document_type_value :=
        coalesce(
          nullif(unit_payload ->> 'documentType',''),
          nullif(selected_batch.payload ->> 'documentType','')
        );

      if document_type_value not in ('course_outline','scheme_of_work') then
        continue;
      end if;

      source_unit_key := unit_payload ->> 'sourceUnitKey';

      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'sequence', coalesce((item ->> 'sequence')::integer, 0),
            'topic', coalesce(item ->> 'topic',''),
            'coverage', coalesce(item ->> 'coverage',''),
            'learningOutcomes', coalesce(item ->> 'learningOutcomes',''),
            'activities', coalesce(item ->> 'activities',''),
            'assessment', coalesce(item ->> 'assessment',''),
            'resources', coalesce(item ->> 'resources',''),
            'sourceWeek', item -> 'sourceWeek'
          )
          order by coalesce((item ->> 'sequence')::integer, 0)
        ),
        '[]'::jsonb
      )
      into content_payload
      from jsonb_array_elements(
        coalesce(selected_batch.payload -> 'content','[]'::jsonb)
      ) item
      where item ->> 'sourceUnitKey' = source_unit_key
        and coalesce(
          nullif(item ->> 'excludedAsCalendarActivity','')::boolean,
          false
        ) = false;

      normalized_payload :=
        jsonb_build_object(
          'schemaVersion', 1,
          'unit',
          jsonb_build_object(
            'unitId', matched_unit_id,
            'unitCode', coalesce(
              nullif(unit_payload ->> 'matchedUnitCode',''),
              unit_payload ->> 'sourceUnitCode'
            ),
            'unitName', coalesce(
              nullif(unit_payload ->> 'matchedUnitName',''),
              unit_payload ->> 'sourceUnitName'
            ),
            'contentFamilyKey', coalesce(unit_payload ->> 'contentFamilyKey',''),
            'curriculumVersion', coalesce(
              nullif(unit_payload ->> 'curriculumVersion','')::integer,
              1
            ),
            'unitDescription', coalesce(unit_payload ->> 'unitDescription',''),
            'coreLearningOutcomes', coalesce(unit_payload ->> 'coreLearningOutcomes',''),
            'teachingLearningApproaches', coalesce(unit_payload ->> 'teachingLearningApproaches',''),
            'assessmentApproaches', coalesce(unit_payload ->> 'assessmentApproaches',''),
            'referencesResources', coalesce(unit_payload ->> 'referencesResources','')
          ),
          'content', content_payload,
          'source',
          jsonb_build_object(
            'engineVersion', 5,
            'batchId', selected_batch.id,
            'fileName', selected_batch.original_file_name
          )
        );

      perform public._create_curriculum_document_version_v54(
        selected_batch.department_id,
        matched_unit_id,
        document_type_value,
        'admin_import',
        selected_batch.id,
        selected_batch.original_file_name,
        normalized_payload,
        selected_batch.created_by
      );

      published_count := published_count + 1;
    end loop;

    return published_count;
  end if;

  -- ----------------------------------------------------------
  -- Older V1–V4 payload shape
  -- ----------------------------------------------------------
  if jsonb_typeof(selected_batch.payload -> 'families') = 'array' then
    document_type_value :=
      coalesce(
        nullif(selected_batch.payload ->> 'documentType',''),
        'course_outline'
      );

    if document_type_value not in ('course_outline','scheme_of_work') then
      return 0;
    end if;

    for family_payload in
      select value
      from jsonb_array_elements(selected_batch.payload -> 'families')
    loop
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'sequence', coalesce((week_item ->> 'weekNumber')::integer, 0),
            'topic', coalesce(week_item ->> 'topic',''),
            'coverage', coalesce(week_item ->> 'specificCoverage',''),
            'learningOutcomes', coalesce(week_item ->> 'learningOutcomes',''),
            'activities', coalesce(week_item ->> 'teachingLearningActivities',''),
            'assessment', coalesce(week_item ->> 'assessmentLearningCheck',''),
            'resources', coalesce(week_item ->> 'resources','')
          )
          order by coalesce((week_item ->> 'weekNumber')::integer, 0)
        ),
        '[]'::jsonb
      )
      into content_payload
      from jsonb_array_elements(
        coalesce(family_payload -> 'weeks','[]'::jsonb)
      ) week_item;

      for mapping_payload in
        select value
        from jsonb_array_elements(
          coalesce(family_payload -> 'unitMappings','[]'::jsonb)
        )
      loop
        begin
          mapped_unit_id := (mapping_payload ->> 'unitId')::uuid;
        exception when others then
          continue;
        end;

        select code, name
          into mapped_unit_code, mapped_unit_name
        from public.units
        where id = mapped_unit_id;

        if mapped_unit_code is null then
          continue;
        end if;

        normalized_payload :=
          jsonb_build_object(
            'schemaVersion', 1,
            'unit',
            jsonb_build_object(
              'unitId', mapped_unit_id,
              'unitCode', mapped_unit_code,
              'unitName', mapped_unit_name,
              'contentFamilyKey', coalesce(family_payload ->> 'familyKey',''),
              'curriculumVersion', coalesce(
                nullif(family_payload ->> 'version','')::integer,
                1
              ),
              'unitDescription', coalesce(family_payload ->> 'unitDescription',''),
              'coreLearningOutcomes',
                coalesce(
                  (
                    select string_agg(outcome_item ->> 'text', E'\n')
                    from jsonb_array_elements(
                      coalesce(family_payload -> 'learningOutcomes','[]'::jsonb)
                    ) outcome_item
                  ),
                  ''
                ),
              'teachingLearningApproaches', coalesce(family_payload ->> 'teachingLearningApproaches',''),
              'assessmentApproaches', coalesce(family_payload ->> 'assessmentApproaches',''),
              'referencesResources',
                coalesce(
                  (
                    select string_agg(reference_item ->> 'text', E'\n')
                    from jsonb_array_elements(
                      coalesce(family_payload -> 'references','[]'::jsonb)
                    ) reference_item
                  ),
                  ''
                )
            ),
            'content', content_payload,
            'source',
            jsonb_build_object(
              'engineVersion', coalesce(selected_batch.template_version,'legacy'),
              'batchId', selected_batch.id,
              'fileName', selected_batch.original_file_name
            )
          );

        perform public._create_curriculum_document_version_v54(
          selected_batch.department_id,
          mapped_unit_id,
          document_type_value,
          'legacy_import',
          selected_batch.id,
          selected_batch.original_file_name,
          normalized_payload,
          selected_batch.created_by
        );

        published_count := published_count + 1;
      end loop;
    end loop;
  end if;

  return published_count;
end;
$$;

revoke all on function public.publish_curriculum_import_batch_to_library(uuid)
  from public, anon;
grant execute on function public.publish_curriculum_import_batch_to_library(uuid)
  to authenticated;

-- Reconcile all previously imported/completed curriculum batches.
do $$
declare
  batch_record record;
begin
  for batch_record in
    select id
    from public.curriculum_content_import_batches
    where status in ('completed','imported')
    order by coalesce(imported_at, created_at), created_at, id
  loop
    begin
      perform public.publish_curriculum_import_batch_to_library(batch_record.id);
    exception when others then
      raise notice
        'Curriculum library reconciliation skipped batch %: %',
        batch_record.id,
        sqlerrm;
    end;
  end loop;
end $$;

comment on table public.curriculum_document_versions is
'Central unit-level version history for institutional Course Outlines and Schemes of Work.';
