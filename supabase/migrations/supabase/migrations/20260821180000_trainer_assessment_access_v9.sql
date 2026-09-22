begin;

-- ============================================================================
-- Trainer Allocation-Scoped Assessment Access V9
--
-- A trainer may read academic data only when it belongs to a Teaching
-- Allocation linked to the trainer's authenticated profile.
--
-- Assessment mutations remain HOD/system-admin only in V9. V10 will extend
-- selected roster/markbook actions through allocation-guarded RPCs.
-- ============================================================================

alter type public.app_role
  add value if not exists 'trainer';

-- ----------------------------------------------------------------------------
-- Resolve the authenticated trainer.
-- ----------------------------------------------------------------------------

create or replace function public.current_trainer_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select trainer.id
  from public.trainers as trainer
  join public.profiles as profile
    on profile.id =
       trainer.profile_id
  where trainer.profile_id =
      auth.uid()
    and trainer.is_active = true
    and profile.is_active = true
    and profile.role::text =
      'trainer'
  limit 1;
$$;

revoke all
on function public.current_trainer_id()
from public;

grant execute
on function public.current_trainer_id()
to authenticated;

comment on function public.current_trainer_id() is
  'Returns the active trainer linked to the authenticated trainer-role profile.';

create or replace function public.trainer_can_access_allocation(
  target_allocation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.teaching_allocations
      as allocation
    where allocation.id =
        target_allocation_id
      and allocation.trainer_id =
        public.current_trainer_id()
      and allocation.status::text in (
        'active',
        'completed'
      )
  );
$$;

revoke all
on function public.trainer_can_access_allocation(uuid)
from public;

grant execute
on function public.trainer_can_access_allocation(uuid)
to authenticated;

create or replace function public.trainer_can_access_assessment(
  target_assessment_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  target_period_id uuid;
  target_cohort_id uuid;
  target_unit_id uuid;
begin
  if public.current_trainer_id() is null then
    return false;
  end if;

  select
    workspace.academic_period_id,
    workspace.cohort_id,
    workspace.unit_id
  into
    target_period_id,
    target_cohort_id,
    target_unit_id
  from public.assessment_event_workspace
    as workspace
  where workspace.id =
    target_assessment_id;

  if not found then
    return false;
  end if;

  return exists (
    select 1
    from public.teaching_allocations
      as allocation
    where allocation.trainer_id =
        public.current_trainer_id()
      and allocation.academic_period_id =
        target_period_id
      and allocation.unit_id =
        target_unit_id
      and (
        target_cohort_id is null
        or allocation.cohort_id =
          target_cohort_id
      )
      and allocation.status::text in (
        'active',
        'completed'
      )
  );
end;
$$;

revoke all
on function public.trainer_can_access_assessment(uuid)
from public;

grant execute
on function public.trainer_can_access_assessment(uuid)
to authenticated;

comment on function public.trainer_can_access_assessment(uuid) is
  'True only when the authenticated trainer owns a matching Academic Period/unit/cohort Teaching Allocation.';

-- ----------------------------------------------------------------------------
-- Optional HOD provisioning helper.
--
-- The trainer must already have an authenticated profile with the same email
-- as the trainer record. This function links the two and changes only that
-- matched profile to the trainer role.
-- ----------------------------------------------------------------------------

create or replace function public.provision_trainer_access(
  target_trainer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  trainer_row record;
  profile_row record;
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
      'Only an authorized HOD or system administrator may provision trainer access.'
      using errcode = '42501';
  end if;

  select
    trainer.id,
    trainer.email,
    trainer.profile_id
  into
    trainer_row
  from public.trainers
    as trainer
  where trainer.id =
    target_trainer_id
  for update;

  if not found then
    raise exception
      'Trainer was not found.'
      using errcode = 'P0002';
  end if;

  if trainer_row.email is null
     or trim(trainer_row.email) = ''
  then
    raise exception
      'The trainer must have an email address before staff access can be provisioned.'
      using errcode = '23514';
  end if;

  select
    profile.id,
    profile.email
  into
    profile_row
  from public.profiles
    as profile
  where lower(profile.email) =
    lower(trainer_row.email)
  limit 1;

  if not found then
    raise exception
      'No authenticated profile matches this trainer email.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.trainers
      as another_trainer
    where another_trainer.profile_id =
        profile_row.id
      and another_trainer.id <>
        target_trainer_id
  ) then
    raise exception
      'This authenticated profile is already linked to another trainer.'
      using errcode = '23505';
  end if;

  execute
    'update public.profiles
        set role = ''trainer''::public.app_role,
            updated_at = now()
      where id = $1'
  using profile_row.id;

  update public.trainers
  set
    profile_id =
      profile_row.id,
    updated_at =
      now()
  where id =
    target_trainer_id;

  return jsonb_build_object(
    'trainerId',
    target_trainer_id,
    'profileId',
    profile_row.id,
    'email',
    profile_row.email,
    'role',
    'trainer'
  );
end;
$$;

revoke all
on function public.provision_trainer_access(uuid)
from public;

grant execute
on function public.provision_trainer_access(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- RLS helpers.
-- ----------------------------------------------------------------------------

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'trainers',
    'teaching_allocations',
    'academic_periods',
    'cohorts',
    'units',
    'assessment_events',
    'assessment_roster',
    'assessment_results',
    'assessment_rules',
    'students',
    'assessment_markbook_generations',
    'assessment_markbook_import_batches',
    'assessment_markbook_import_stage_rows'
  ]
  loop
    if to_regclass(
         format(
           'public.%I',
           target_table
         )
       ) is not null
    then
      execute format(
        'alter table public.%I enable row level security',
        target_table
      );
    end if;
  end loop;
end;
$$;

-- Preserve full HOD/system-admin access even on tables whose historical
-- migrations did not yet define an explicit policy.

drop policy if exists v9_hod_trainers_all
on public.trainers;

create policy v9_hod_trainers_all
on public.trainers
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_self_read
on public.trainers;

create policy v9_trainer_self_read
on public.trainers
for select
to authenticated
using (
  id =
  public.current_trainer_id()
);

drop policy if exists v9_hod_allocations_all
on public.teaching_allocations;

create policy v9_hod_allocations_all
on public.teaching_allocations
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_allocations_read
on public.teaching_allocations;

create policy v9_trainer_allocations_read
on public.teaching_allocations
for select
to authenticated
using (
  trainer_id =
    public.current_trainer_id()
  and status::text in (
    'active',
    'completed'
  )
);

drop policy if exists v9_hod_periods_all
on public.academic_periods;

create policy v9_hod_periods_all
on public.academic_periods
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_periods_read
on public.academic_periods;

create policy v9_trainer_periods_read
on public.academic_periods
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_allocations
      as allocation
    where allocation.academic_period_id =
        academic_periods.id
      and allocation.trainer_id =
        public.current_trainer_id()
      and allocation.status::text in (
        'active',
        'completed'
      )
  )
);

drop policy if exists v9_hod_cohorts_all
on public.cohorts;

create policy v9_hod_cohorts_all
on public.cohorts
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_cohorts_read
on public.cohorts;

create policy v9_trainer_cohorts_read
on public.cohorts
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_allocations
      as allocation
    where allocation.cohort_id =
        cohorts.id
      and allocation.trainer_id =
        public.current_trainer_id()
      and allocation.status::text in (
        'active',
        'completed'
      )
  )
);

drop policy if exists v9_hod_units_all
on public.units;

create policy v9_hod_units_all
on public.units
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_units_read
on public.units;

create policy v9_trainer_units_read
on public.units
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_allocations
      as allocation
    where allocation.unit_id =
        units.id
      and allocation.trainer_id =
        public.current_trainer_id()
      and allocation.status::text in (
        'active',
        'completed'
      )
  )
);

drop policy if exists v9_hod_events_all
on public.assessment_events;

create policy v9_hod_events_all
on public.assessment_events
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_events_read
on public.assessment_events;

create policy v9_trainer_events_read
on public.assessment_events
for select
to authenticated
using (
  public.trainer_can_access_assessment(
    id
  )
);

drop policy if exists v9_hod_roster_all
on public.assessment_roster;

create policy v9_hod_roster_all
on public.assessment_roster
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_roster_read
on public.assessment_roster;

create policy v9_trainer_roster_read
on public.assessment_roster
for select
to authenticated
using (
  public.trainer_can_access_assessment(
    assessment_id
  )
);

drop policy if exists v9_hod_results_all
on public.assessment_results;

create policy v9_hod_results_all
on public.assessment_results
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_results_read
on public.assessment_results;

create policy v9_trainer_results_read
on public.assessment_results
for select
to authenticated
using (
  public.trainer_can_access_assessment(
    assessment_event_id
  )
);

drop policy if exists v9_hod_rules_all
on public.assessment_rules;

create policy v9_hod_rules_all
on public.assessment_rules
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_rules_read
on public.assessment_rules;

create policy v9_trainer_rules_read
on public.assessment_rules
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_allocations
      as allocation
    where allocation.academic_period_id =
        assessment_rules.academic_period_id
      and allocation.unit_id =
        assessment_rules.unit_id
      and allocation.trainer_id =
        public.current_trainer_id()
      and allocation.status::text in (
        'active',
        'completed'
      )
  )
);

drop policy if exists v9_hod_students_all
on public.students;

create policy v9_hod_students_all
on public.students
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_students_read
on public.students;

create policy v9_trainer_students_read
on public.students
for select
to authenticated
using (
  exists (
    select 1
    from public.assessment_roster
      as roster
    where roster.student_id =
        students.id
      and public.trainer_can_access_assessment(
        roster.assessment_id
      )
  )
);

-- Audit/import tables are read-only for trainers and continue to be managed
-- through security-definer workflow RPCs.

drop policy if exists v9_hod_markbook_generations_all
on public.assessment_markbook_generations;

create policy v9_hod_markbook_generations_all
on public.assessment_markbook_generations
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_markbook_generations_read
on public.assessment_markbook_generations;

create policy v9_trainer_markbook_generations_read
on public.assessment_markbook_generations
for select
to authenticated
using (
  public.trainer_can_access_assessment(
    root_assessment_id
  )
);

drop policy if exists v9_hod_import_batches_all
on public.assessment_markbook_import_batches;

create policy v9_hod_import_batches_all
on public.assessment_markbook_import_batches
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_import_batches_read
on public.assessment_markbook_import_batches;

create policy v9_trainer_import_batches_read
on public.assessment_markbook_import_batches
for select
to authenticated
using (
  public.trainer_can_access_assessment(
    root_assessment_id
  )
);

drop policy if exists v9_hod_stage_rows_all
on public.assessment_markbook_import_stage_rows;

create policy v9_hod_stage_rows_all
on public.assessment_markbook_import_stage_rows
for all
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists v9_trainer_stage_rows_read
on public.assessment_markbook_import_stage_rows;

create policy v9_trainer_stage_rows_read
on public.assessment_markbook_import_stage_rows
for select
to authenticated
using (
  public.trainer_can_access_assessment(
    assessment_id
  )
);

grant select
on public.trainers,
   public.teaching_allocations,
   public.academic_periods,
   public.cohorts,
   public.units,
   public.assessment_events,
   public.assessment_roster,
   public.assessment_results,
   public.assessment_rules,
   public.students,
   public.assessment_markbook_generations,
   public.assessment_markbook_import_batches,
   public.assessment_markbook_import_stage_rows
to authenticated;

grant select
on public.assessment_event_workspace,
   public.assessment_population_workspace_rows,
   public.assessment_population_summary
to authenticated;

commit;
