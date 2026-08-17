-- ============================================================
-- v12.13.0 - Controlled cohort/student stage progression
-- ============================================================

create table if not exists public.student_stage_progression_events (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete restrict,
  cohort_id uuid references public.cohorts(id) on delete set null,
  from_stage_id uuid not null references public.programme_stages(id) on delete restrict,
  to_stage_id uuid not null references public.programme_stages(id) on delete restrict,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now(),
  note text,
  constraint student_stage_progression_different_stage check (from_stage_id <> to_stage_id)
);

create index if not exists student_stage_progression_events_student_idx
  on public.student_stage_progression_events (student_id, changed_at desc);

create index if not exists student_stage_progression_events_cohort_idx
  on public.student_stage_progression_events (cohort_id, changed_at desc);

alter table public.student_stage_progression_events enable row level security;

drop policy if exists student_stage_progression_events_department_read
  on public.student_stage_progression_events;

create policy student_stage_progression_events_department_read
on public.student_stage_progression_events
for select
to authenticated
using (
  department_id = (select public.current_user_primary_department_id())
  and (
    select public.current_user_can_manage_department(department_id)
  )
);

create or replace function public.progress_students_to_next_stage(
  target_student_ids uuid[],
  progression_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_count integer := 0;
  progressed_count integer := 0;
  skipped_count integer := 0;
  actor_department_id uuid;
  row_record record;
  next_stage_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if not public.current_user_has_role(
    array['hod','system_admin']::public.app_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only an HOD or system administrator can progress students';
  end if;

  actor_department_id := public.current_user_primary_department_id();

  if actor_department_id is null then
    raise exception 'An active department is required';
  end if;

  requested_count := coalesce(cardinality(target_student_ids), 0);

  if requested_count = 0 then
    raise exception 'Select at least one student';
  end if;

  for row_record in
    select
      s.id as student_id,
      s.programme_id,
      s.current_cohort_id as cohort_id,
      s.current_stage_id,
      ps.sequence_number
    from public.students s
    join public.programmes p on p.id = s.programme_id
    left join public.programme_stages ps on ps.id = s.current_stage_id
    where s.id = any(target_student_ids)
      and p.department_id = actor_department_id
      and s.lifecycle_status in ('admitted','active')
    for update of s
  loop
    next_stage_id := null;

    if row_record.current_stage_id is not null
       and row_record.sequence_number is not null then
      select candidate.id
      into next_stage_id
      from public.programme_stages candidate
      where candidate.programme_id = row_record.programme_id
        and candidate.is_active
        and candidate.sequence_number = row_record.sequence_number + 1
      limit 1;
    end if;

    if next_stage_id is null then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    update public.students
    set current_stage_id = next_stage_id,
        updated_at = now()
    where id = row_record.student_id;

    insert into public.student_stage_progression_events (
      department_id,
      student_id,
      programme_id,
      cohort_id,
      from_stage_id,
      to_stage_id,
      changed_by,
      note
    )
    values (
      actor_department_id,
      row_record.student_id,
      row_record.programme_id,
      row_record.cohort_id,
      row_record.current_stage_id,
      next_stage_id,
      auth.uid(),
      nullif(trim(progression_note), '')
    );

    progressed_count := progressed_count + 1;
  end loop;

  skipped_count := skipped_count + greatest(
    requested_count - progressed_count - skipped_count,
    0
  );

  return jsonb_build_object(
    'requested_students', requested_count,
    'progressed_students', progressed_count,
    'skipped_students', skipped_count
  );
end;
$$;

revoke all
on function public.progress_students_to_next_stage(uuid[], text)
from public, anon;

grant execute
on function public.progress_students_to_next_stage(uuid[], text)
to authenticated;

comment on table public.student_stage_progression_events is
  'Audit history of HOD-controlled student academic stage progression.';

comment on function public.progress_students_to_next_stage(uuid[], text) is
  'Progresses only explicitly selected eligible students to the next active stage in their own programme.';
