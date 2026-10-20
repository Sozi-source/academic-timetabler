-- One trainer URL can cover equivalent unit markbooks while retaining a
-- separate editable/submitted scope for every assessment and cohort.

alter table public.assessment_trainer_mark_invites
  add column if not exists parent_invite_id uuid
    references public.assessment_trainer_mark_invites(id) on delete cascade,
  add column if not exists cohort_id uuid references public.cohorts(id) on delete cascade,
  add column if not exists scope_unit_id uuid references public.units(id) on delete cascade,
  add column if not exists scope_period_id uuid references public.academic_periods(id) on delete cascade;

create index if not exists assessment_trainer_mark_invites_parent_scope_idx
  on public.assessment_trainer_mark_invites (parent_invite_id, assessment_id, cohort_id);

do $migration$
declare
  function_definition text;
begin
  function_definition := pg_get_functiondef(
    'public.save_assessment_marks_with_trainer_invite(text,jsonb,boolean)'::regprocedure
  );

  function_definition := replace(
    function_definition,
    'and roster.student_id = item.student_id',
    'and roster.student_id = item.student_id
     and (selected_invite.cohort_id is null or roster.cohort_id = selected_invite.cohort_id)'
  );
  function_definition := replace(
    function_definition,
    'where roster.assessment_id = selected_invite.assessment_id;',
    'where roster.assessment_id = selected_invite.assessment_id
      and (selected_invite.cohort_id is null or roster.cohort_id = selected_invite.cohort_id);'
  );
  function_definition := replace(
    function_definition,
    'where roster.assessment_id = selected_invite.assessment_id
        and (',
    'where roster.assessment_id = selected_invite.assessment_id
        and (selected_invite.cohort_id is null or roster.cohort_id = selected_invite.cohort_id)
        and ('
  );

  if position('selected_invite.cohort_id' in function_definition) = 0 then
    raise exception 'Could not apply cohort scoping to trainer mark submissions';
  end if;

  execute function_definition;
end;
$migration$;
