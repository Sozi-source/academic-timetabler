-- ============================================================
-- Student Lifecycle Phase 4: progression management
-- ============================================================
-- Provides one transactional transition function so lifecycle status,
-- cohort history and audit timeline cannot drift apart.

create or replace function public.record_student_lifecycle_transition(
  target_student_id uuid,
  transition_event public.student_lifecycle_event_type,
  transition_date date,
  target_cohort_id uuid default null,
  expected_resume_on date default null,
  transition_reason text default null,
  transition_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_student public.students%rowtype;
  selected_target_cohort public.cohorts%rowtype;
  new_status public.student_lifecycle_status;
  timeline_id uuid;
  current_assignment public.student_cohort_assignments%rowtype;
begin
  select * into selected_student
  from public.students
  where id = target_student_id
  for update;

  if selected_student.id is null then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;

  if not public.current_user_can_manage_department(selected_student.department_id) then
    raise exception using errcode = '42501', message = 'You cannot manage this student';
  end if;

  if transition_date is null then
    raise exception using errcode = '22004', message = 'Effective date is required';
  end if;

  if transition_event not in (
    'deferral'::public.student_lifecycle_event_type,
    'resumption'::public.student_lifecycle_event_type,
    'leave_started'::public.student_lifecycle_event_type,
    'withdrawal'::public.student_lifecycle_event_type,
    'discontinuation'::public.student_lifecycle_event_type,
    'programme_completion'::public.student_lifecycle_event_type,
    'graduation'::public.student_lifecycle_event_type
  ) then
    raise exception using errcode = '22023', message = 'Unsupported lifecycle transition';
  end if;

  if transition_event = 'deferral' then
    if selected_student.lifecycle_status not in ('admitted','active') then
      raise exception using errcode = 'P0001', message = 'Only active or admitted students can defer';
    end if;
    if expected_resume_on is null or expected_resume_on <= transition_date then
      raise exception using errcode = '22023', message = 'A future expected resumption date is required for deferral';
    end if;
    new_status := 'deferred';
  elsif transition_event = 'leave_started' then
    if selected_student.lifecycle_status not in ('admitted','active') then
      raise exception using errcode = 'P0001', message = 'Only active or admitted students can start leave';
    end if;
    if expected_resume_on is null or expected_resume_on <= transition_date then
      raise exception using errcode = '22023', message = 'A future expected return date is required for leave';
    end if;
    new_status := 'on_leave';
  elsif transition_event = 'resumption' then
    if selected_student.lifecycle_status not in ('deferred','on_leave') then
      raise exception using errcode = 'P0001', message = 'Only deferred or leave students can resume';
    end if;
    if target_cohort_id is null then
      raise exception using errcode = '22004', message = 'A study cohort is required for resumption';
    end if;

    select * into selected_target_cohort from public.cohorts where id = target_cohort_id;
    if selected_target_cohort.id is null or selected_target_cohort.programme_id <> selected_student.programme_id then
      raise exception using errcode = 'P0001', message = 'Resumption cohort must belong to the student programme';
    end if;
    if selected_target_cohort.status not in ('planned','active') then
      raise exception using errcode = 'P0001', message = 'Resumption cohort must be planned or active';
    end if;

    new_status := 'active';
  elsif transition_event = 'withdrawal' then
    if selected_student.lifecycle_status in ('completed','graduated','withdrawn','discontinued') then
      raise exception using errcode = 'P0001', message = 'This student cannot be withdrawn from the current status';
    end if;
    new_status := 'withdrawn';
  elsif transition_event = 'discontinuation' then
    if selected_student.lifecycle_status in ('completed','graduated','withdrawn','discontinued') then
      raise exception using errcode = 'P0001', message = 'This student cannot be discontinued from the current status';
    end if;
    new_status := 'discontinued';
  elsif transition_event = 'programme_completion' then
    if selected_student.lifecycle_status not in ('admitted','active') then
      raise exception using errcode = 'P0001', message = 'Only active or admitted students can complete the programme';
    end if;
    new_status := 'completed';
  elsif transition_event = 'graduation' then
    if selected_student.lifecycle_status <> 'completed' then
      raise exception using errcode = 'P0001', message = 'Only completed students can be marked graduated';
    end if;
    new_status := 'graduated';
  end if;

  if transition_event in ('deferral','leave_started','withdrawal','discontinuation')
     and nullif(trim(coalesce(transition_reason,'')), '') is null then
    raise exception using errcode = '22023', message = 'Reason is required for this transition';
  end if;

  if transition_event = 'resumption' then
    select * into current_assignment
    from public.student_cohort_assignments
    where student_id = target_student_id and effective_to is null
    order by effective_from desc
    limit 1
    for update;

    if current_assignment.id is not null and current_assignment.cohort_id <> target_cohort_id then
      if transition_date <= current_assignment.effective_from then
        raise exception using errcode = '22023', message = 'Resumption date must be after the current cohort assignment start date';
      end if;

      update public.student_cohort_assignments
      set effective_to = transition_date - 1
      where id = current_assignment.id;

      insert into public.student_cohort_assignments(
        student_id, cohort_id, effective_from, is_admission_cohort, assignment_reason, notes
      ) values (
        target_student_id, target_cohort_id, transition_date, false,
        'Resumption after ' || replace(selected_student.lifecycle_status::text, '_', ' '),
        nullif(trim(coalesce(transition_notes,'')), '')
      );
    elsif current_assignment.id is null then
      insert into public.student_cohort_assignments(
        student_id, cohort_id, effective_from, is_admission_cohort, assignment_reason, notes
      ) values (
        target_student_id, target_cohort_id, transition_date, false,
        'Resumption cohort', nullif(trim(coalesce(transition_notes,'')), '')
      );
    end if;

    update public.students
    set lifecycle_status = new_status,
        current_cohort_id = target_cohort_id,
        projected_completion_date = selected_target_cohort.expected_completion_date
    where id = target_student_id;
  else
    update public.students
    set lifecycle_status = new_status
    where id = target_student_id;
  end if;

  insert into public.student_lifecycle_events(
    student_id,
    event_type,
    effective_date,
    from_cohort_id,
    to_cohort_id,
    expected_resume_date,
    reason,
    notes
  ) values (
    target_student_id,
    transition_event,
    transition_date,
    selected_student.current_cohort_id,
    case when transition_event = 'resumption' then target_cohort_id else null end,
    expected_resume_on,
    nullif(trim(coalesce(transition_reason,'')), ''),
    nullif(trim(coalesce(transition_notes,'')), '')
  ) returning id into timeline_id;

  return timeline_id;
end;
$$;

grant execute on function public.record_student_lifecycle_transition(uuid, public.student_lifecycle_event_type, date, uuid, date, text, text) to authenticated;

comment on function public.record_student_lifecycle_transition(uuid, public.student_lifecycle_event_type, date, uuid, date, text, text) is
  'Atomically records a controlled student progression transition, updates lifecycle status and maintains effective-dated cohort history on resumption.';

-- Keep the student's projection aligned with the current study cohort when
-- no explicit projection has been supplied.
create or replace function public.sync_student_projected_completion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cohort_completion date;
begin
  if new.current_cohort_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.projected_completion_date is not null then
      return new;
    end if;
  elsif new.current_cohort_id is not distinct from old.current_cohort_id
        and new.projected_completion_date is not null then
    return new;
  end if;

  select expected_completion_date into cohort_completion
  from public.cohorts
  where id = new.current_cohort_id;

  if tg_op = 'INSERT'
     or new.projected_completion_date is null
     or new.current_cohort_id is distinct from old.current_cohort_id then
    new.projected_completion_date := cohort_completion;
  end if;

  return new;
end;
$$;

drop trigger if exists students_sync_projected_completion on public.students;
create trigger students_sync_projected_completion
before insert or update of current_cohort_id, projected_completion_date on public.students
for each row execute function public.sync_student_projected_completion();

update public.students s
set projected_completion_date = c.expected_completion_date
from public.cohorts c
where s.current_cohort_id = c.id
  and s.projected_completion_date is null;
