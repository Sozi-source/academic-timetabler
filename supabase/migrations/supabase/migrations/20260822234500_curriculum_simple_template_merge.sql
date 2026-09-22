-- ============================================================
-- Academic Planner — Curriculum Simple Templates V2
-- Course Outline and Scheme of Work imports merge into the same
-- curriculum family without erasing each other's fields.
-- ============================================================

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
  import_document_type text;
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

  import_document_type := coalesce(selected_batch.payload ->> 'documentType', 'course_outline');
  if import_document_type not in ('course_outline','scheme_of_work') then
    raise exception using errcode='P0001', message='Unsupported curriculum document type';
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
      name = excluded.name,
      -- Scheme import must not wipe Course Outline metadata.
      unit_description = case
        when import_document_type = 'course_outline' then excluded.unit_description
        else public.curriculum_families.unit_description
      end,
      overall_competency = case
        when import_document_type = 'course_outline' then excluded.overall_competency
        else public.curriculum_families.overall_competency
      end,
      teaching_learning_approaches = case
        when import_document_type = 'course_outline' then excluded.teaching_learning_approaches
        else public.curriculum_families.teaching_learning_approaches
      end,
      assessment_approaches = case
        when import_document_type = 'course_outline' then excluded.assessment_approaches
        else public.curriculum_families.assessment_approaches
      end,
      status='approved',
      approved_at=now(),
      approved_by=auth.uid(),
      updated_at=now()
    returning id into family_id_value;

    if import_document_type = 'course_outline' then
      delete from public.curriculum_learning_outcomes where curriculum_family_id=family_id_value;
      delete from public.curriculum_references where curriculum_family_id=family_id_value;

      for outcome_payload in
        select value from jsonb_array_elements(coalesce(family_payload -> 'learningOutcomes','[]'::jsonb))
      loop
        insert into public.curriculum_learning_outcomes(curriculum_family_id,sequence,learning_outcome)
        values(family_id_value,(outcome_payload ->> 'sequence')::integer,outcome_payload ->> 'text');
      end loop;

      for reference_payload in
        select value from jsonb_array_elements(coalesce(family_payload -> 'references','[]'::jsonb))
      loop
        insert into public.curriculum_references(curriculum_family_id,sequence,reference_resource)
        values(family_id_value,(reference_payload ->> 'sequence')::integer,reference_payload ->> 'text');
      end loop;
    end if;

    for week_payload in select value from jsonb_array_elements(family_payload -> 'weeks') loop
      if import_document_type = 'course_outline' then
        insert into public.curriculum_weeks(
          curriculum_family_id,week_number,topic,specific_coverage,
          learning_outcomes,teaching_learning_activities,assessment_learning_check,resources
        ) values (
          family_id_value,
          (week_payload ->> 'weekNumber')::integer,
          week_payload ->> 'topic',
          nullif(week_payload ->> 'specificCoverage',''),
          null,null,null,null
        )
        on conflict (curriculum_family_id,week_number)
        do update set
          topic=excluded.topic,
          specific_coverage=excluded.specific_coverage;
      else
        insert into public.curriculum_weeks(
          curriculum_family_id,week_number,topic,specific_coverage,
          learning_outcomes,teaching_learning_activities,assessment_learning_check,resources
        ) values (
          family_id_value,
          (week_payload ->> 'weekNumber')::integer,
          week_payload ->> 'topic',
          nullif(week_payload ->> 'specificCoverage',''),
          nullif(week_payload ->> 'learningOutcomes',''),
          nullif(week_payload ->> 'teachingLearningActivities',''),
          nullif(week_payload ->> 'assessmentLearningCheck',''),
          nullif(week_payload ->> 'resources','')
        )
        on conflict (curriculum_family_id,week_number)
        do update set
          topic=excluded.topic,
          specific_coverage=excluded.specific_coverage,
          learning_outcomes=excluded.learning_outcomes,
          teaching_learning_activities=excluded.teaching_learning_activities,
          assessment_learning_check=excluded.assessment_learning_check,
          resources=excluded.resources;
      end if;
      week_total := week_total + 1;
    end loop;

    for mapping_payload in select value from jsonb_array_elements(family_payload -> 'unitMappings') loop
      delete from public.curriculum_unit_mappings where unit_id=(mapping_payload ->> 'unitId')::uuid;
      insert into public.curriculum_unit_mappings(curriculum_family_id,unit_id,is_primary,created_by)
      values(
        family_id_value,
        (mapping_payload ->> 'unitId')::uuid,
        coalesce((mapping_payload ->> 'isPrimary')::boolean,false),
        auth.uid()
      );
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
