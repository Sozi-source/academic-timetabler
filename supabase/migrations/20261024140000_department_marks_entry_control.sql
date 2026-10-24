-- ============================================================================
-- Migration: Department-wide marks entry control function
--
-- Adds:
--   public.set_department_trainer_entry(uuid, boolean)
--
-- Purpose:
--   Provides an authoritative HOD/Admin control to open or lock/close marks
--   entry across all unit markbooks in the department for a given academic period
--   in a single atomic transaction.
-- ============================================================================

create or replace function public.set_department_trainer_entry(
  p_academic_period_id uuid,
  p_should_open boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
  v_updated_count integer := 0;
  rec record;
begin
  if auth.uid() is null or not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]) then
    raise exception 'HOD access is required.' using errcode = '42501';
  end if;

  select active_department_id into v_department_id
  from public.profiles
  where id = auth.uid() and is_active;

  if not found or v_department_id is null then
    raise exception 'Select an active department.' using errcode = '42501';
  end if;

  if p_should_open then
    -- When opening marks entry: Ensure all allocated units in this department
    -- that have active student registrations have a markbook ready.
    for rec in (
      select distinct sur.unit_id
      from public.student_unit_registrations sur
      join public.units u on u.id = sur.unit_id
      left join public.programmes p on p.id = u.programme_id
      where sur.academic_period_id = p_academic_period_id
        and sur.registration_status = 'registered'
        and coalesce(u.department_id, p.department_id) = v_department_id
    ) loop
      begin
        perform public.ensure_unit_markbook_ready(p_academic_period_id, rec.unit_id);
      exception when others then
        -- Skip any unit that cannot be provisioned
        null;
      end;
    end loop;
  end if;

  -- Update all active/open unit markbooks for this department and academic period
  update public.assessment_events
  set trainer_entry_open = p_should_open,
      updated_at = now()
  where department_id = v_department_id
    and academic_period_id = p_academic_period_id
    and title = 'Unit Markbook'
    and assessment_type = 'exam'
    and status <> 'closed'
    and exam_marks_finalized_at is null
    and not exists (
      select 1 from public.assessment_event_workspace workspace
      where workspace.id = assessment_events.id
        and workspace.workflow_status in ('submitted', 'finalised', 'archived')
    );

  get diagnostics v_updated_count = row_count;

  -- When closing (locking), re-sync rosters so students registered during the open window are flushed
  if not p_should_open then
    for rec in (
      select distinct ae.unit_id
      from public.assessment_events ae
      where ae.department_id = v_department_id
        and ae.academic_period_id = p_academic_period_id
        and ae.title = 'Unit Markbook'
        and ae.assessment_type = 'exam'
    ) loop
      begin
        perform public.ensure_unit_markbook_ready(p_academic_period_id, rec.unit_id);
      exception when others then
        null;
      end;
    end loop;
  end if;

  return jsonb_build_object(
    'success', true,
    'open', p_should_open,
    'updatedCount', v_updated_count
  );
end;
$$;

revoke all on function public.set_department_trainer_entry(uuid, boolean) from public, anon;
grant execute on function public.set_department_trainer_entry(uuid, boolean) to authenticated, service_role;

comment on function public.set_department_trainer_entry(uuid, boolean) is
  'HOD/Admin control to open or lock/close marks entry across all unit markbooks in the department for a period.';
