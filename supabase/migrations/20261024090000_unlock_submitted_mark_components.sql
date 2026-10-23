create or replace function public.unlock_assessment_mark_component_submission(
  target_assessment_id uuid,
  target_cohort_id uuid,
  target_component_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assessment_department_id uuid;
  assessment_workflow_status text;
  deleted_rows integer;
begin
  if auth.uid() is null
     or not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[])
  then
    raise exception 'Only an HOD or system administrator may unlock submitted marks.'
      using errcode = '42501';
  end if;

  if target_component_key not in ('assignment', 'presentation', 'rat', 'cat', 'exam') then
    raise exception 'Select a valid mark component.' using errcode = '22023';
  end if;

  select event.department_id, coalesce(workspace.workflow_status, 'open')
  into assessment_department_id, assessment_workflow_status
  from public.assessment_events event
  left join public.assessment_event_workspace workspace on workspace.id = event.id
  where event.id = target_assessment_id;

  if not found then
    raise exception 'Assessment was not found.' using errcode = 'P0002';
  end if;
  if not public.current_user_can_manage_department(assessment_department_id) then
    raise exception 'This assessment is outside your working department.' using errcode = '42501';
  end if;
  if assessment_workflow_status in ('submitted', 'finalised', 'archived')
     or exists (
       select 1 from public.assessment_online_mark_submissions submission
       where submission.assessment_id = target_assessment_id
     )
  then
    raise exception 'A finalized markbook cannot be reopened with a component unlock.' using errcode = '23514';
  end if;

  delete from public.assessment_mark_component_submissions submission
  where submission.assessment_id = target_assessment_id
    and submission.cohort_id is not distinct from target_cohort_id
    and submission.component_key = target_component_key;
  get diagnostics deleted_rows = row_count;

  if deleted_rows = 0 then
    raise exception 'This component has no submitted lock to remove.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.unlock_assessment_mark_component_submission(uuid, uuid, text) from public, anon;
grant execute on function public.unlock_assessment_mark_component_submission(uuid, uuid, text) to authenticated;

comment on function public.unlock_assessment_mark_component_submission(uuid, uuid, text) is
  'Allows an HOD or system administrator in the assessment department to unlock one submitted component before the markbook is finalized.';
