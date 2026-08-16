-- Timetable lifecycle changes are completed separately from scheduling
-- repairs. Managers explicitly return a protected timetable to an editable
-- state, after which generator and editor actions can run normally.

create or replace function public.block_timetable_version_hard_constraints()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('under_review', 'approved', 'published') then
    return new;
  end if;

  if exists (
    select 1
    from public.scheduled_sessions session
    join public.cohorts cohort on cohort.id = session.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where session.academic_period_id = new.academic_period_id
      and programme.department_id = new.department_id
      and session.status in ('draft', 'confirmed', 'locked')
      and public.get_scheduled_session_hard_constraint_violation(
        session.academic_period_id,
        session.teaching_allocation_id,
        session.trainer_id,
        session.room_id,
        session.cohort_id,
        session.working_day_id,
        session.start_time_slot_id,
        session.end_time_slot_id
      ) is not null
  ) then
    raise exception
      'Resolve all hard scheduling-constraint conflicts before creating or publishing a timetable version';
  end if;

  return new;
end;
$$;

create or replace function public.return_timetable_to_editable_draft(
  target_academic_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  protected_version record;
  reopened_version_count integer := 0;
  archived_published_version_count integer := 0;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department before editing a timetable';
  end if;

  if target_academic_period_id is null then
    raise exception using
      errcode = '22023',
      message = 'Select an Academic Period before returning a timetable to draft';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'return-timetable-to-draft:'
      || active_department::text
      || ':'
      || target_academic_period_id::text,
    0
  ));

  for protected_version in
    select version.id, version.status, version.version_number
    from public.timetable_versions version
    where version.department_id = active_department
      and version.academic_period_id = target_academic_period_id
      and version.status in ('under_review', 'approved', 'published')
    order by version.version_number desc
    for update
  loop
    if protected_version.status = 'published' then
      update public.timetable_versions
      set
        status = 'archived',
        archived_by = auth.uid(),
        archived_at = now(),
        updated_at = now()
      where id = protected_version.id;

      insert into public.timetable_publication_events (
        timetable_version_id,
        event_type,
        from_status,
        to_status,
        note,
        performed_by
      ) values (
        protected_version.id,
        'archived',
        protected_version.status,
        'archived',
        'Archived automatically when the timetable owner returned the live timetable to editable draft.',
        auth.uid()
      );

      archived_published_version_count :=
        archived_published_version_count + 1;
    else
      update public.timetable_versions
      set
        status = 'draft',
        updated_at = now()
      where id = protected_version.id;

      insert into public.timetable_publication_events (
        timetable_version_id,
        event_type,
        from_status,
        to_status,
        note,
        performed_by
      ) values (
        protected_version.id,
        'reopened',
        protected_version.status,
        'draft',
        'Returned to draft automatically by the timetable owner for editing.',
        auth.uid()
      );

      reopened_version_count := reopened_version_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'reopenedVersionCount', reopened_version_count,
    'archivedPublishedVersionCount', archived_published_version_count
  );
end;
$$;

revoke all on function public.return_timetable_to_editable_draft(uuid)
from public;
grant execute on function public.return_timetable_to_editable_draft(uuid)
to authenticated;

comment on function public.return_timetable_to_editable_draft(uuid) is
  'Separately returns protected review and approval versions to draft, archives an immutable published snapshot, records automatic audit events, and leaves the live timetable editable.';
