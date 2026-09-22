-- Timetable owners publish the validated live draft in one atomic action.
-- The version title is generated from the Academic Period name, the previous
-- published snapshot is archived, and no manual review note is required.

create or replace function public.publish_current_timetable(
  target_academic_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  selected_period record;
  next_version_number integer;
  automatic_title text;
  published_version_id uuid;
  published_session_count integer;
  previous_version record;
  archived_version_count integer := 0;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department before publishing a timetable';
  end if;

  if target_academic_period_id is null then
    raise exception using
      errcode = '22023',
      message = 'Select an Academic Period before publishing a timetable';
  end if;

  select period.name, period.status
  into selected_period
  from public.academic_periods period
  where period.id = target_academic_period_id;

  if selected_period.name is null then
    raise exception using
      errcode = 'P0002',
      message = 'The selected Academic Period was not found';
  end if;

  if selected_period.status not in ('planned', 'active') then
    raise exception using
      errcode = '55000',
      message = 'Only a planned or active Academic Period timetable may be published';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'timetable-version:'
      || active_department::text
      || ':'
      || target_academic_period_id::text,
    0
  ));

  select coalesce(max(version.version_number), 0) + 1
  into next_version_number
  from public.timetable_versions version
  where version.department_id = active_department
    and version.academic_period_id = target_academic_period_id;

  automatic_title := trim(selected_period.name)
    || ' · v'
    || next_version_number::text;

  published_version_id := public.create_timetable_version(
    target_academic_period_id,
    automatic_title,
    null
  );

  for previous_version in
    select version.id, version.status
    from public.timetable_versions version
    where version.department_id = active_department
      and version.academic_period_id = target_academic_period_id
      and version.status = 'published'
      and version.id <> published_version_id
    for update
  loop
    update public.timetable_versions
    set
      status = 'archived',
      archived_by = auth.uid(),
      archived_at = now(),
      updated_at = now()
    where id = previous_version.id;

    insert into public.timetable_publication_events (
      timetable_version_id,
      event_type,
      from_status,
      to_status,
      note,
      performed_by
    ) values (
      previous_version.id,
      'archived',
      previous_version.status,
      'archived',
      'Archived automatically when a newer timetable version was published.',
      auth.uid()
    );

    archived_version_count := archived_version_count + 1;
  end loop;

  update public.timetable_versions
  set
    status = 'published',
    published_by = auth.uid(),
    published_at = now(),
    updated_at = now()
  where id = published_version_id;

  insert into public.timetable_publication_events (
    timetable_version_id,
    event_type,
    from_status,
    to_status,
    note,
    performed_by
  ) values (
    published_version_id,
    'published',
    'draft',
    'published',
    'Published directly after automatic timetable validation.',
    auth.uid()
  );

  select version.session_count
  into published_session_count
  from public.timetable_versions version
  where version.id = published_version_id;

  return jsonb_build_object(
    'versionId', published_version_id,
    'versionNumber', next_version_number,
    'title', automatic_title,
    'sessionCount', published_session_count,
    'archivedVersionCount', archived_version_count
  );
end;
$$;

revoke all on function public.publish_current_timetable(uuid)
from public;
grant execute on function public.publish_current_timetable(uuid)
to authenticated;

-- The simplified interface is the only authenticated publication entry point.
-- The functions remain available internally so the atomic publisher can reuse
-- the existing, fully validated snapshot builder.
revoke all on function public.create_timetable_version(uuid, text, text)
from authenticated;
revoke all on function public.transition_timetable_version(uuid, text, text)
from authenticated;

comment on function public.publish_current_timetable(uuid) is
  'Creates and publishes the next Academic Period-labelled timetable version atomically, archiving the former published snapshot without a manual review or comment step.';
