begin;

-- ============================================================================
-- Academic Planner — Online Record of Work V1
--
-- Rule:
--   latest published timetable -> unsubmitted lesson rows
--   submitted lesson -> immutable historical snapshot
--
-- Pending rows are NOT stored. They are derived at read time from the current
-- published timetable version, so a newly published timetable automatically
-- replaces future/unsubmitted dates and times.
-- ============================================================================

-- Future timetable snapshots must carry the allocation identity directly.
-- This preserves exact ownership even if the mutable scheduled_sessions rows
-- are later regenerated or deleted from the live draft.
do $migration$
declare
  current_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(
    'public.create_timetable_version(uuid,text,text)'::regprocedure
  )
  into current_definition;

  if position(
    '''teachingAllocationId'''
    in current_definition
  ) = 0 then
    if position(
      '''id'', session.id,'
      in current_definition
    ) = 0 then
      raise exception
        'create_timetable_version did not contain the expected session id snapshot field';
    end if;

    corrected_definition := replace(
      current_definition,
      '''id'', session.id,',
      '''id'', session.id, ''teachingAllocationId'', session.teaching_allocation_id,'
    );

    execute corrected_definition;
  end if;
end
$migration$;

comment on function public.create_timetable_version(uuid,text,text) is
  'Creates an immutable timetable snapshot including teachingAllocationId so downstream academic records can bind to the exact published allocation.';

-- Backfill existing timetable snapshots where allocation identity can be
-- recovered safely from the original session or exact period/unit/trainer/cohort.
do $migration$
declare
  version_row record;
  rebuilt_snapshot jsonb;
begin
  for version_row in
    select
      version.id,
      version.academic_period_id,
      version.snapshot
    from public.timetable_versions version
    where jsonb_typeof(version.snapshot) = 'array'
  loop
    select coalesce(
      jsonb_agg(
        case
          when item ? 'teachingAllocationId'
            and nullif(item ->> 'teachingAllocationId', '') is not null
          then item
          else item || jsonb_build_object(
            'teachingAllocationId',
            coalesce(
              (
                select session.teaching_allocation_id
                from public.scheduled_sessions session
                where session.id =
                  nullif(item ->> 'id', '')::uuid
                limit 1
              ),
              (
                select allocation.id
                from public.teaching_allocations allocation
                where allocation.academic_period_id =
                    version_row.academic_period_id
                  and allocation.unit_id =
                    nullif(item ->> 'unitId', '')::uuid
                  and allocation.trainer_id =
                    nullif(item ->> 'trainerId', '')::uuid
                  and (
                    nullif(item ->> 'cohortId', '') is null
                    or allocation.cohort_id =
                      nullif(item ->> 'cohortId', '')::uuid
                  )
                order by
                  case
                    when allocation.cohort_id =
                      nullif(item ->> 'cohortId', '')::uuid
                    then 0
                    else 1
                  end,
                  allocation.created_at,
                  allocation.id
                limit 1
              )
            )
          )
        end
        order by ordinality
      ),
      '[]'::jsonb
    )
    into rebuilt_snapshot
    from jsonb_array_elements(
      version_row.snapshot
    ) with ordinality as snapshot_item(item, ordinality);

    update public.timetable_versions
    set
      snapshot = rebuilt_snapshot,
      updated_at = updated_at
    where id = version_row.id;
  end loop;
end
$migration$;

-- A normalized audit table replaces JSON-in-filename as the primary Record of
-- Work store. One row is one actually submitted lesson.
create table if not exists public.record_of_work_entries (
  id uuid primary key default gen_random_uuid(),

  allocation_id uuid not null
    references public.teaching_allocations(id)
    on delete restrict,

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  cohort_id uuid not null
    references public.cohorts(id)
    on delete restrict,

  unit_id uuid not null
    references public.units(id)
    on delete restrict,

  trainer_id uuid not null
    references public.trainers(id)
    on delete restrict,

  timetable_version_id uuid not null
    references public.timetable_versions(id)
    on delete restrict,

  timetable_version_number integer not null
    check (timetable_version_number >= 1),

  timetable_title text not null
    check (length(trim(timetable_title)) > 0),

  timetable_session_id uuid not null,

  scheme_document_version_id uuid
    references public.curriculum_document_versions(id)
    on delete set null,

  occurrence_date date not null,

  week_number integer not null
    check (week_number between 1 and 52),

  session_number integer not null
    check (session_number between 1 and 50),

  start_time time not null,
  end_time time not null,

  topic_covered text not null
    check (
      length(trim(topic_covered))
      between 1 and 4000
    ),

  objectives text not null
    check (
      length(trim(objectives))
      between 1 and 6000
    ),

  delivery_mode text not null
    check (
      length(trim(delivery_mode))
      between 1 and 120
    ),

  remarks text
    check (
      remarks is null
      or length(remarks) <= 3000
    ),

  class_representative_name text
    check (
      class_representative_name is null
      or length(trim(class_representative_name)) <= 200
    ),

  class_representative_confirmed_at timestamptz,

  trainer_profile_id uuid
    references public.profiles(id)
    on delete restrict,

  trainer_name_snapshot text not null
    check (
      length(trim(trainer_name_snapshot)) > 0
    ),

  status text not null default 'submitted'
    check (
      status in ('submitted','voided')
    ),

  review_status text not null default 'pending'
    check (
      review_status in ('pending','approved','returned')
    ),

  review_note text
    check (
      review_note is null
      or length(review_note) <= 3000
    ),

  reviewed_by uuid
    references public.profiles(id)
    on delete set null,

  reviewed_at timestamptz,

  submitted_at timestamptz not null
    default now(),

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint record_of_work_entries_time_order
    check (end_time > start_time),

  constraint record_of_work_entries_rep_confirmation
    check (
      class_representative_confirmed_at is null
      or class_representative_name is not null
    )
);

create unique index if not exists
  record_of_work_entries_occurrence_unique
on public.record_of_work_entries (
  allocation_id,
  occurrence_date,
  session_number
)
where status = 'submitted';

create index if not exists
  record_of_work_entries_allocation_date_idx
on public.record_of_work_entries (
  allocation_id,
  occurrence_date,
  start_time
);

create index if not exists
  record_of_work_entries_period_idx
on public.record_of_work_entries (
  academic_period_id,
  unit_id,
  cohort_id,
  trainer_id
);

create index if not exists
  record_of_work_entries_review_idx
on public.record_of_work_entries (
  review_status,
  submitted_at
)
where status = 'submitted';

alter table public.record_of_work_entries
  enable row level security;

drop policy if exists
  record_of_work_entries_read
on public.record_of_work_entries;

create policy record_of_work_entries_read
on public.record_of_work_entries
for select
to authenticated
using (
  public.teaching_document_actor_can_manage_allocation(
    allocation_id
  )
);

drop policy if exists
  record_of_work_entries_insert
on public.record_of_work_entries;

create policy record_of_work_entries_insert
on public.record_of_work_entries
for insert
to authenticated
with check (
  public.teaching_document_actor_can_manage_allocation(
    allocation_id
  )
);

grant select, insert
on public.record_of_work_entries
to authenticated;

-- Submitted academic history is immutable to normal authenticated SQL.
-- Service-role application actions remain able to implement an audited HOD
-- correction/void workflow later.
create or replace function public.protect_submitted_record_of_work()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role'
     and old.status = 'submitted'
  then
    raise exception
      'Submitted Record of Work entries are immutable.'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists
  protect_submitted_record_of_work_trigger
on public.record_of_work_entries;

create trigger
  protect_submitted_record_of_work_trigger
before update or delete
on public.record_of_work_entries
for each row
execute function
  public.protect_submitted_record_of_work();

-- Ensure the online record can create its ordinary teaching_documents parent
-- even when no uploaded Record of Work presentation template exists.
do $migration$
declare
  next_version integer;
begin
  if not exists (
    select 1
    from public.teaching_document_templates
    where document_type = 'record_of_work'
  ) then
    select
      coalesce(max(version_number), 0) + 1
    into next_version
    from public.teaching_document_templates
    where document_type = 'record_of_work';

    insert into public.teaching_document_templates (
      document_type,
      name,
      version_number,
      status,
      notes
    )
    values (
      'record_of_work',
      'Online Record of Work',
      next_version,
      'draft',
      'Internal system record. Date and time are supplied by the current published timetable.'
    );
  end if;
end
$migration$;

comment on table public.record_of_work_entries is
  'Submitted online Record of Work lesson history. Unsubmitted rows are derived dynamically from the latest published timetable and are intentionally not persisted.';

comment on column public.record_of_work_entries.timetable_version_id is
  'The immutable published timetable version that supplied the submitted lesson date and time.';

comment on column public.record_of_work_entries.scheme_document_version_id is
  'The active Scheme of Work version used to prefill the lesson topic/objectives when the record was submitted.';

commit;
