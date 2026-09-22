begin;

-- ============================================================================
-- Assessment Rules + Finalise/Publish V8
--
-- Rules are scoped to Academic Period + unit + assessment type.
-- Finalisation validates the locked roster and committed operational results.
-- Publication is deliberately separate from finalisation.
-- ============================================================================

create table if not exists public.assessment_rules (
  id uuid primary key
    default gen_random_uuid(),

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  unit_id uuid not null
    references public.units(id)
    on delete restrict,

  assessment_type text not null,

  maximum_mark numeric not null,
  pass_mark numeric not null,

  created_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  updated_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint assessment_rules_type_check
    check (
      assessment_type in (
        'cat',
        'exam'
      )
    ),

  constraint assessment_rules_marks_check
    check (
      maximum_mark > 0
      and pass_mark >= 0
      and pass_mark <= maximum_mark
    ),

  constraint assessment_rules_scope_unique
    unique (
      academic_period_id,
      unit_id,
      assessment_type
    )
);

create index if not exists
  assessment_rules_period_type_idx
on public.assessment_rules (
  academic_period_id,
  assessment_type,
  unit_id
);

alter table public.assessment_rules
  enable row level security;

drop policy if exists
  assessment_rules_hod_read
on public.assessment_rules;

create policy assessment_rules_hod_read
on public.assessment_rules
for select
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

comment on table public.assessment_rules is
  'Assessment maximum and pass marks scoped to one Academic Period, unit and CAT/Exam type.';

create or replace function public.enforce_assessment_stage_rule()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed_maximum numeric;
begin
  if new.result_status <> 'sat' then
    return new;
  end if;

  select
    rule.maximum_mark
  into
    allowed_maximum
  from public.assessment_markbook_import_batches
    as batch
  join public.assessment_rules
    as rule
    on rule.academic_period_id =
       batch.academic_period_id
   and rule.unit_id =
       batch.unit_id
   and rule.assessment_type =
       batch.assessment_type
  where batch.id =
    new.batch_id;

  if not found then
    raise exception
      'Configure the assessment maximum and pass mark before staging marks.'
      using errcode = '23514';
  end if;

  if new.mark is null
     or new.mark < 0
     or new.mark > allowed_maximum
  then
    raise exception
      'A staged mark is outside the configured assessment range.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists
  assessment_stage_rule_guard
on public.assessment_markbook_import_stage_rows;

create trigger assessment_stage_rule_guard
before insert or update
on public.assessment_markbook_import_stage_rows
for each row
execute function public.enforce_assessment_stage_rule();

create or replace function public.enforce_assessment_result_rule()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed_maximum numeric;
begin
  if new.source_markbook_batch_id is null
     or new.operational_result_status <> 'sat'
  then
    return new;
  end if;

  select
    rule.maximum_mark
  into
    allowed_maximum
  from public.assessment_markbook_import_batches
    as batch
  join public.assessment_rules
    as rule
    on rule.academic_period_id =
       batch.academic_period_id
   and rule.unit_id =
       batch.unit_id
   and rule.assessment_type =
       batch.assessment_type
  where batch.id =
    new.source_markbook_batch_id;

  if not found then
    raise exception
      'Configure the assessment maximum and pass mark before committing results.'
      using errcode = '23514';
  end if;

  if new.operational_mark is null
     or new.operational_mark < 0
     or new.operational_mark > allowed_maximum
  then
    raise exception
      'A result mark is outside the configured assessment range.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists
  assessment_result_rule_guard
on public.assessment_results;

create trigger assessment_result_rule_guard
before insert or update
on public.assessment_results
for each row
execute function public.enforce_assessment_result_rule();

create or replace function public.set_assessment_rule(
  target_assessment_id uuid,
  target_maximum_mark numeric,
  target_pass_mark numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_period_id uuid;
  target_unit_id uuid;
  target_type text;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may configure assessment rules.'
      using errcode = '42501';
  end if;

  if target_maximum_mark is null
     or target_maximum_mark <= 0
     or target_pass_mark is null
     or target_pass_mark < 0
     or target_pass_mark > target_maximum_mark
  then
    raise exception
      'Assessment maximum and pass marks are invalid.'
      using errcode = '23514';
  end if;

  select
    workspace.academic_period_id,
    workspace.unit_id,
    workspace.assessment_type
  into
    target_period_id,
    target_unit_id,
    target_type
  from public.assessment_event_workspace
    as workspace
  where workspace.id =
    target_assessment_id;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  if target_type not in (
    'cat',
    'exam'
  ) then
    raise exception
      'Assessment type must be CAT or Exam.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.assessment_event_workspace
      as workspace
    join public.assessment_events
      as event
      on event.id =
         workspace.id
    where workspace.academic_period_id =
        target_period_id
      and workspace.unit_id =
        target_unit_id
      and workspace.assessment_type =
        target_type
      and (
        workspace.workflow_status in (
          'finalised',
          'archived'
        )
        or event.published_at is not null
      )
  ) then
    raise exception
      'Assessment rules cannot be changed after finalisation or publication.'
      using errcode = '23514';
  end if;

  insert into public.assessment_rules (
    academic_period_id,
    unit_id,
    assessment_type,
    maximum_mark,
    pass_mark,
    created_by,
    updated_by
  )
  values (
    target_period_id,
    target_unit_id,
    target_type,
    target_maximum_mark,
    target_pass_mark,
    auth.uid(),
    auth.uid()
  )
  on conflict (
    academic_period_id,
    unit_id,
    assessment_type
  )
  do update
  set
    maximum_mark =
      excluded.maximum_mark,
    pass_mark =
      excluded.pass_mark,
    updated_by =
      auth.uid(),
    updated_at =
      now();

  return jsonb_build_object(
    'assessmentId',
    target_assessment_id,
    'academicPeriodId',
    target_period_id,
    'unitId',
    target_unit_id,
    'assessmentType',
    target_type,
    'maximumMark',
    target_maximum_mark,
    'passMark',
    target_pass_mark
  );
end;
$$;

revoke all
on function public.set_assessment_rule(
  uuid,
  numeric,
  numeric
)
from public;

grant execute
on function public.set_assessment_rule(
  uuid,
  numeric,
  numeric
)
to authenticated;

create or replace function public.finalise_assessment_bundle(
  target_assessment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_period_id uuid;
  target_unit_id uuid;
  target_type text;

  bundle_event_ids uuid[];

  rule_maximum_mark numeric;
  rule_pass_mark numeric;

  roster_count integer := 0;
  result_count integer := 0;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may finalise assessment results.'
      using errcode = '42501';
  end if;

  select
    workspace.academic_period_id,
    workspace.unit_id,
    workspace.assessment_type
  into
    target_period_id,
    target_unit_id,
    target_type
  from public.assessment_event_workspace
    as workspace
  where workspace.id =
    target_assessment_id;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  select
    array_agg(
      workspace.id
      order by workspace.id
    )
  into
    bundle_event_ids
  from public.assessment_event_workspace
    as workspace
  where workspace.academic_period_id =
      target_period_id
    and workspace.unit_id =
      target_unit_id
    and workspace.assessment_type =
      target_type
    and exists (
      select 1
      from public.assessment_roster
        as roster
      where roster.assessment_id =
        workspace.id
    );

  if bundle_event_ids is null
     or not (
       target_assessment_id =
       any(bundle_event_ids)
     )
  then
    raise exception
      'The assessment has no locked roster to finalise.'
      using errcode = 'P0002';
  end if;

  select
    rule.maximum_mark,
    rule.pass_mark
  into
    rule_maximum_mark,
    rule_pass_mark
  from public.assessment_rules
    as rule
  where rule.academic_period_id =
      target_period_id
    and rule.unit_id =
      target_unit_id
    and rule.assessment_type =
      target_type;

  if not found then
    raise exception
      'Configure the assessment maximum and pass mark before finalising.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.assessment_events
      as event
    where event.id =
        any(bundle_event_ids)
      and event.published_at is not null
  ) then
    raise exception
      'Published assessment results cannot be finalised again.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.assessment_events
      as event
    where event.id =
        any(bundle_event_ids)
      and event.operational_workflow_status not in (
        'submitted',
        'finalised'
      )
  ) then
    raise exception
      'All participating assessment events must be submitted before finalisation.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.assessment_results
      as result
    where result.assessment_event_id =
        any(bundle_event_ids)
      and result.operational_result_status is not null
    group by
      result.assessment_event_id,
      result.student_id
    having count(*) > 1
  ) then
    raise exception
      'Duplicate operational result rows were found. Resolve them before finalisation.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.assessment_roster
      as roster
    where roster.assessment_id =
        any(bundle_event_ids)
      and not exists (
        select 1
        from public.assessment_results
          as result
        where result.assessment_event_id =
            roster.assessment_id
          and result.student_id =
            roster.student_id
          and (
            (
              result.operational_result_status =
                'sat'
              and result.operational_mark is not null
              and result.operational_mark >= 0
              and result.operational_mark <=
                rule_maximum_mark
            )
            or
            (
              result.operational_result_status =
                'absent'
              and result.operational_mark is null
            )
          )
      )
  ) then
    raise exception
      'Missing, invalid or over-maximum marks remain. Correct and recommit the assessment before finalising.'
      using errcode = '23514';
  end if;

  select
    count(*)::integer
  into
    roster_count
  from public.assessment_roster
  where assessment_id =
    any(bundle_event_ids);

  select
    count(*)::integer
  into
    result_count
  from public.assessment_results
  where assessment_event_id =
      any(bundle_event_ids)
    and operational_result_status in (
      'sat',
      'absent'
    );

  update public.assessment_events
  set
    operational_workflow_status =
      'finalised',
    finalised_at =
      coalesce(
        finalised_at,
        now()
      )
  where id =
    any(bundle_event_ids);

  return jsonb_build_object(
    'assessmentId',
    target_assessment_id,
    'status',
    'finalised',
    'registeredPopulation',
    roster_count,
    'resultCount',
    result_count,
    'maximumMark',
    rule_maximum_mark,
    'passMark',
    rule_pass_mark
  );
end;
$$;

revoke all
on function public.finalise_assessment_bundle(uuid)
from public;

grant execute
on function public.finalise_assessment_bundle(uuid)
to authenticated;

create or replace function public.publish_assessment_bundle(
  target_assessment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_period_id uuid;
  target_unit_id uuid;
  target_type text;

  bundle_event_ids uuid[];
  published_timestamp timestamptz;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may publish assessment results.'
      using errcode = '42501';
  end if;

  select
    workspace.academic_period_id,
    workspace.unit_id,
    workspace.assessment_type
  into
    target_period_id,
    target_unit_id,
    target_type
  from public.assessment_event_workspace
    as workspace
  where workspace.id =
    target_assessment_id;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  select
    array_agg(
      workspace.id
      order by workspace.id
    )
  into
    bundle_event_ids
  from public.assessment_event_workspace
    as workspace
  where workspace.academic_period_id =
      target_period_id
    and workspace.unit_id =
      target_unit_id
    and workspace.assessment_type =
      target_type
    and exists (
      select 1
      from public.assessment_roster
        as roster
      where roster.assessment_id =
        workspace.id
    );

  if bundle_event_ids is null
     or not (
       target_assessment_id =
       any(bundle_event_ids)
     )
  then
    raise exception
      'The assessment has no finalisable roster.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.assessment_events
      as event
    where event.id =
        any(bundle_event_ids)
      and event.operational_workflow_status <>
        'finalised'
  ) then
    raise exception
      'All participating assessment events must be finalised before publication.'
      using errcode = '23514';
  end if;

  published_timestamp :=
    now();

  update public.assessment_events
  set
    published_at =
      coalesce(
        published_at,
        published_timestamp
      )
  where id =
    any(bundle_event_ids);

  return jsonb_build_object(
    'assessmentId',
    target_assessment_id,
    'status',
    'published',
    'publishedAt',
    published_timestamp,
    'assessmentCount',
    cardinality(
      bundle_event_ids
    )
  );
end;
$$;

revoke all
on function public.publish_assessment_bundle(uuid)
from public;

grant execute
on function public.publish_assessment_bundle(uuid)
to authenticated;

comment on function public.finalise_assessment_bundle(uuid) is
  'Validates a complete locked CAT/EXAM roster against committed results and freezes the assessment as finalised.';

comment on function public.publish_assessment_bundle(uuid) is
  'Publishes only an already-finalised CAT/EXAM bundle. Publication remains separate from finalisation.';

commit;
