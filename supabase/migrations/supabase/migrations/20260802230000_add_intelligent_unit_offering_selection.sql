-- ============================================================
-- Intelligent Units on Offer
--
-- Expected units are derived from:
--   cohort.programme_id
--   cohort.current_academic_period_number
--   unit.programme_id
--   unit.academic_period_number
--
-- HODs may:
--   - exclude an expected curriculum unit;
--   - restore it later;
--   - add another unit from the same programme as an exception;
--   - preserve those decisions when recommendations refresh.
-- ============================================================

do $$
begin
  create type public.unit_offering_origin as enum (
    'curriculum',
    'special',
    'import',
    'legacy'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.unit_offering_selection_state as enum (
    'included',
    'excluded'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.unit_offerings
add column origin public.unit_offering_origin
  not null
  default 'curriculum';

alter table public.unit_offerings
add column selection_state
  public.unit_offering_selection_state
  not null
  default 'included';

alter table public.unit_offerings
add column recommended_stage_number integer;

alter table public.unit_offerings
add column exception_reason text;

alter table public.unit_offerings
add column manually_reviewed boolean
  not null
  default false;

alter table public.unit_offerings
add column reviewed_by uuid
  references auth.users(id)
  on delete set null;

alter table public.unit_offerings
add column reviewed_at timestamptz;

-- Existing backfilled rows predate intelligent curriculum
-- recommendation and are retained as legacy records.
update public.unit_offerings
set
  origin = 'legacy',
  selection_state =
    case
      when status = 'cancelled'
        then 'excluded'
          ::public.unit_offering_selection_state
      else 'included'
        ::public.unit_offering_selection_state
    end
where source = 'teaching_offering_backfill';

alter table public.unit_offerings
add constraint
  unit_offerings_recommended_stage_check
check (
  recommended_stage_number is null
  or recommended_stage_number between 1 and 100
);

alter table public.unit_offerings
add constraint
  unit_offerings_exception_reason_length_check
check (
  exception_reason is null
  or char_length(trim(exception_reason))
      between 3 and 1000
);

alter table public.unit_offerings
add constraint
  unit_offerings_exception_reason_required_check
check (
  (
    origin = 'curriculum'
    and selection_state = 'included'
  )
  or exception_reason is not null
);

alter table public.unit_offerings
add constraint
  unit_offerings_review_metadata_check
check (
  (
    manually_reviewed = false
    and reviewed_by is null
    and reviewed_at is null
  )
  or (
    manually_reviewed = true
    and reviewed_by is not null
    and reviewed_at is not null
  )
);

create index
  unit_offerings_selection_idx
on public.unit_offerings (
  academic_period_id,
  cohort_id,
  selection_state
);

create index
  unit_offerings_origin_idx
on public.unit_offerings (
  origin
);

create index
  unit_offerings_recommended_stage_idx
on public.unit_offerings (
  recommended_stage_number
)
where recommended_stage_number is not null;

-- ------------------------------------------------------------
-- Extend unit-offering validation
-- ------------------------------------------------------------

create or replace function
  public.validate_unit_offering()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
begin
  select *
  into selected_period
  from public.academic_periods
  where id = new.academic_period_id;

  if selected_period.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Academic Period not found';
  end if;

  select *
  into selected_cohort
  from public.cohorts
  where id = new.cohort_id;

  if selected_cohort.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Cohort not found';
  end if;

  select *
  into selected_unit
  from public.units
  where id = new.unit_id;

  if selected_unit.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Unit not found';
  end if;

  if selected_cohort.programme_id
      <> selected_unit.programme_id then
    raise exception using
      errcode = '23514',
      message =
        'A Unit on Offer must belong to the same programme as its cohort';
  end if;

  if new.origin = 'curriculum' then
    if selected_unit.academic_period_number
        <> selected_cohort.current_academic_period_number then
      raise exception using
        errcode = '23514',
        message =
          'A curriculum recommendation must belong to the cohort current academic stage';
    end if;

    new.recommended_stage_number =
      selected_cohort.current_academic_period_number;
  end if;

  if new.origin = 'special' then
    if new.exception_reason is null
       or char_length(trim(new.exception_reason)) < 3 then
      raise exception using
        errcode = '23514',
        message =
          'A special Unit on Offer requires an exception reason';
    end if;
  end if;

  if new.selection_state = 'excluded' then
    new.is_timetable_enabled = false;

    if new.status <> 'cancelled' then
      new.status =
        'cancelled'
          ::public.unit_offering_status;
    end if;
  end if;

  if new.offering_type in (
    'clinical_rotation',
    'attachment',
    'examination'
  ) then
    new.is_timetable_enabled = false;
  end if;

  if new.manually_reviewed then
    new.reviewed_by =
      coalesce(
        new.reviewed_by,
        auth.uid()
      );

    new.reviewed_at =
      coalesce(
        new.reviewed_at,
        now()
      );
  else
    new.reviewed_by = null;
    new.reviewed_at = null;
  end if;

  new.source = trim(new.source);

  if new.exception_reason is not null then
    new.exception_reason =
      trim(new.exception_reason);
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- Curriculum recommendation function
--
-- Existing decisions are never overwritten.
--
-- A curriculum unit that has already been manually excluded
-- stays excluded when this function is called again.
-- ------------------------------------------------------------

create or replace function
  public.refresh_curriculum_unit_offerings(
    selected_academic_period_id uuid,
    selected_cohort_id uuid
  )
returns table (
  recommended_count integer,
  inserted_count integer,
  existing_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_cohort public.cohorts%rowtype;
  selected_period public.academic_periods%rowtype;
  total_recommended integer := 0;
  total_inserted integer := 0;
  total_existing integer := 0;
begin
  if not (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  ) then
    raise exception using
      errcode = '42501',
      message =
        'You are not authorized to refresh Units on Offer';
  end if;

  select *
  into selected_period
  from public.academic_periods
  where id = selected_academic_period_id;

  if selected_period.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Academic Period not found';
  end if;

  select *
  into selected_cohort
  from public.cohorts
  where id = selected_cohort_id;

  if selected_cohort.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Cohort not found';
  end if;

  select count(*)::integer
  into total_recommended
  from public.units unit_record
  where
    unit_record.programme_id =
      selected_cohort.programme_id
    and unit_record.academic_period_number =
      selected_cohort.current_academic_period_number
    and unit_record.is_active = true;

  select count(*)::integer
  into total_existing
  from public.unit_offerings offering
  join public.units unit_record
    on unit_record.id = offering.unit_id
  where
    offering.academic_period_id =
      selected_academic_period_id
    and offering.cohort_id =
      selected_cohort_id
    and unit_record.programme_id =
      selected_cohort.programme_id
    and unit_record.academic_period_number =
      selected_cohort.current_academic_period_number
    and unit_record.is_active = true;

  with inserted as (
    insert into public.unit_offerings (
      academic_period_id,
      cohort_id,
      unit_id,
      offering_type,
      status,
      is_timetable_enabled,
      weekly_sessions,
      session_duration_minutes,
      delivery_notes,
      source,
      origin,
      selection_state,
      recommended_stage_number,
      manually_reviewed,
      created_by,
      updated_by
    )
    select
      selected_academic_period_id,
      selected_cohort_id,
      unit_record.id,

      case
        when coalesce(
          unit_record.practical_hours,
          0
        ) > coalesce(
          unit_record.theory_hours,
          0
        )
          then 'practical'
            ::public.unit_offering_type
        else 'classroom'
          ::public.unit_offering_type
      end,

      'draft'
        ::public.unit_offering_status,

      true,

      unit_record.weekly_sessions,

      120,

      null,

      'automatic_curriculum_recommendation',

      'curriculum'
        ::public.unit_offering_origin,

      'included'
        ::public.unit_offering_selection_state,

      selected_cohort.current_academic_period_number,

      false,

      auth.uid(),

      auth.uid()

    from public.units unit_record
    where
      unit_record.programme_id =
        selected_cohort.programme_id
      and unit_record.academic_period_number =
        selected_cohort.current_academic_period_number
      and unit_record.is_active = true

    on conflict (
      academic_period_id,
      cohort_id,
      unit_id
    )
    do nothing

    returning id
  )
  select count(*)::integer
  into total_inserted
  from inserted;

  return query
  select
    total_recommended,
    total_inserted,
    total_existing;
end;
$$;

revoke all
on function public.refresh_curriculum_unit_offerings(
  uuid,
  uuid
)
from public;

grant execute
on function public.refresh_curriculum_unit_offerings(
  uuid,
  uuid
)
to authenticated;

-- ------------------------------------------------------------
-- Manual inclusion/exclusion helper
-- ------------------------------------------------------------

create or replace function
  public.set_unit_offering_selection(
    selected_unit_offering_id uuid,
    selected_state
      public.unit_offering_selection_state,
    selected_reason text
  )
returns public.unit_offerings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.unit_offerings%rowtype;
begin
  if not (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  ) then
    raise exception using
      errcode = '42501',
      message =
        'You are not authorized to change Units on Offer';
  end if;

  if selected_state = 'excluded'
     and (
       selected_reason is null
       or char_length(trim(selected_reason)) < 3
     ) then
    raise exception using
      errcode = '23514',
      message =
        'Provide a reason when excluding a recommended unit';
  end if;

  update public.unit_offerings
  set
    selection_state = selected_state,

    exception_reason =
      case
        when selected_state = 'excluded'
          then trim(selected_reason)
        else null
      end,

    status =
      case
        when selected_state = 'excluded'
          then 'cancelled'
            ::public.unit_offering_status
        else 'draft'
          ::public.unit_offering_status
      end,

    is_timetable_enabled =
      case
        when selected_state = 'excluded'
          then false
        when offering_type in (
          'attachment',
          'clinical_rotation',
          'examination'
        )
          then false
        else true
      end,

    manually_reviewed = true,
    reviewed_by = auth.uid(),
    reviewed_at = now()

  where id = selected_unit_offering_id

  returning *
  into result;

  if result.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Unit on Offer not found';
  end if;

  return result;
end;
$$;

revoke all
on function public.set_unit_offering_selection(
  uuid,
  public.unit_offering_selection_state,
  text
)
from public;

grant execute
on function public.set_unit_offering_selection(
  uuid,
  public.unit_offering_selection_state,
  text
)
to authenticated;

-- ------------------------------------------------------------
-- Special-unit helper
--
-- A special unit may come from a different stage, but it must
-- still belong to the cohort programme.
-- ------------------------------------------------------------

create or replace function
  public.add_special_unit_offering(
    selected_academic_period_id uuid,
    selected_cohort_id uuid,
    selected_unit_id uuid,
    selected_reason text
  )
returns public.unit_offerings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
  result public.unit_offerings%rowtype;
begin
  if not (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  ) then
    raise exception using
      errcode = '42501',
      message =
        'You are not authorized to add a special Unit on Offer';
  end if;

  if selected_reason is null
     or char_length(trim(selected_reason)) < 3 then
    raise exception using
      errcode = '23514',
      message =
        'A special Unit on Offer requires a reason';
  end if;

  select *
  into selected_cohort
  from public.cohorts
  where id = selected_cohort_id;

  if selected_cohort.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Cohort not found';
  end if;

  select *
  into selected_unit
  from public.units
  where id = selected_unit_id;

  if selected_unit.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Unit not found';
  end if;

  if selected_unit.programme_id
      <> selected_cohort.programme_id then
    raise exception using
      errcode = '23514',
      message =
        'A special unit must still belong to the cohort programme';
  end if;

  insert into public.unit_offerings (
    academic_period_id,
    cohort_id,
    unit_id,
    offering_type,
    status,
    is_timetable_enabled,
    weekly_sessions,
    session_duration_minutes,
    source,
    origin,
    selection_state,
    recommended_stage_number,
    exception_reason,
    manually_reviewed,
    reviewed_by,
    reviewed_at,
    created_by,
    updated_by
  )
  values (
    selected_academic_period_id,
    selected_cohort_id,
    selected_unit_id,

    case
      when coalesce(
        selected_unit.practical_hours,
        0
      ) > coalesce(
        selected_unit.theory_hours,
        0
      )
        then 'practical'
          ::public.unit_offering_type
      else 'classroom'
        ::public.unit_offering_type
    end,

    'draft'
      ::public.unit_offering_status,

    true,

    selected_unit.weekly_sessions,

    120,

    'manual_special_exception',

    'special'
      ::public.unit_offering_origin,

    'included'
      ::public.unit_offering_selection_state,

    selected_unit.academic_period_number,

    trim(selected_reason),

    true,

    auth.uid(),

    now(),

    auth.uid(),

    auth.uid()
  )

  on conflict (
    academic_period_id,
    cohort_id,
    unit_id
  )
  do update set
    origin = 'special',
    selection_state = 'included',
    status = 'draft',
    is_timetable_enabled = true,
    exception_reason =
      excluded.exception_reason,
    manually_reviewed = true,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_by = auth.uid(),
    updated_at = now()

  returning *
  into result;

  return result;
end;
$$;

revoke all
on function public.add_special_unit_offering(
  uuid,
  uuid,
  uuid,
  text
)
from public;

grant execute
on function public.add_special_unit_offering(
  uuid,
  uuid,
  uuid,
  text
)
to authenticated;

comment on column
  public.unit_offerings.origin is
  'Identifies whether the unit came from the expected curriculum stage, a special exception, an import or legacy data.';

comment on column
  public.unit_offerings.selection_state is
  'Records whether the HOD included or excluded the unit from delivery in this Academic Period.';

comment on column
  public.unit_offerings.exception_reason is
  'Required explanation for excluded expected units and special additions.';

comment on function
  public.refresh_curriculum_unit_offerings(uuid, uuid) is
  'Adds missing expected units for a cohort current stage without overwriting existing HOD decisions.';