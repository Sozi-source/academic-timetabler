-- Student status workflow: Active, Deferred, Dropped Out, Suspended, Completed, Graduated.
-- Status changes are intentionally simple: select a status and save. The system
-- records today's date and an audit event automatically. Historical records are
-- retained; non-active students are excluded from active-semester rosters.

begin;

alter type public.student_lifecycle_status add value if not exists 'suspended';

-- New student records are Active by default. Existing admitted records are
-- normalized to Active because the registry now treats Active as the default state.
alter table public.students alter column lifecycle_status set default 'active';
update public.students
set lifecycle_status = 'active', updated_at = now()
where lifecycle_status = 'admitted';

create or replace function public.sync_student_academic_phase()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lifecycle_status = 'deferred' then
    new.academic_phase := 'deferred';
  elsif new.lifecycle_status = 'suspended' then
    new.academic_phase := 'in_class';
  elsif new.lifecycle_status = 'completed' then
    new.academic_phase := 'awaiting_graduation';
  elsif new.lifecycle_status = 'graduated' then
    new.academic_phase := 'graduated';
  elsif new.lifecycle_status = 'dropped_out' then
    new.academic_phase := 'dropped_out';
  elsif new.lifecycle_status = 'active' and new.academic_phase in ('deferred','awaiting_graduation','graduated','dropped_out') then
    new.academic_phase := 'in_class';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_student_academic_phase_trigger on public.students;
create trigger sync_student_academic_phase_trigger
before insert or update of lifecycle_status on public.students
for each row execute function public.sync_student_academic_phase();

create or replace function public.sync_student_reporting_lifecycle_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_reporting_status text;
begin
  next_reporting_status := case
    when new.lifecycle_status = 'deferred' then 'deferred'
    when new.lifecycle_status in ('dropped_out','suspended','completed','graduated','withdrawn','discontinued') then 'dropped_out'
    else null
  end;

  if next_reporting_status is not null then
    update public.student_period_reporting reporting
    set reporting_status = next_reporting_status,
        reported_on = null,
        confirmed_at = null,
        confirmed_by = null,
        updated_at = now()
    from public.academic_periods period
    where reporting.student_id = new.id
      and reporting.academic_period_id = period.id
      and period.status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_student_reporting_lifecycle_status on public.students;
create trigger sync_student_reporting_lifecycle_status
after update of lifecycle_status on public.students
for each row
when (old.lifecycle_status is distinct from new.lifecycle_status)
execute function public.sync_student_reporting_lifecycle_status();

create or replace function public.set_student_status(
  target_student_id uuid,
  target_status text,
  effective_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_rec public.students%rowtype;
  event_value public.student_lifecycle_event_type;
  phase_value public.student_academic_phase;
  event_id uuid;
  old_status public.student_lifecycle_status;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Only an HOD or system administrator can update student status';
  end if;
  if effective_date is null then
    effective_date := current_date;
  end if;
  if target_status not in ('active','deferred','dropped_out','suspended','completed','graduated') then
    raise exception using errcode = '22023', message = 'Invalid target status';
  end if;

  select * into student_rec from public.students where id = target_student_id for update;
  if student_rec.id is null then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;
  if not public.current_user_can_manage_department(student_rec.department_id) then
    raise exception using errcode = '42501', message = 'You cannot manage this student';
  end if;

  old_status := student_rec.lifecycle_status;
  if old_status::text = target_status then
    return null;
  end if;

  event_value := case target_status
    when 'deferred' then 'deferral'::public.student_lifecycle_event_type
    when 'dropped_out' then 'dropout'::public.student_lifecycle_event_type
    when 'suspended' then 'administrative_correction'::public.student_lifecycle_event_type
    when 'completed' then 'programme_completion'::public.student_lifecycle_event_type
    when 'graduated' then 'graduation'::public.student_lifecycle_event_type
    when 'active' then 'resumption'::public.student_lifecycle_event_type
  end;

  phase_value := case target_status
    when 'deferred' then 'deferred'::public.student_academic_phase
    when 'dropped_out' then 'dropped_out'::public.student_academic_phase
    when 'suspended' then 'in_class'::public.student_academic_phase
    when 'completed' then 'awaiting_graduation'::public.student_academic_phase
    when 'graduated' then 'graduated'::public.student_academic_phase
    else 'in_class'::public.student_academic_phase
  end;

  update public.students
  set lifecycle_status = target_status::public.student_lifecycle_status,
      academic_phase = phase_value,
      completion_date = case when target_status = 'completed' then effective_date when target_status = 'active' then completion_date else completion_date end,
      graduation_date = case when target_status = 'graduated' then effective_date else graduation_date end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = target_student_id;

  insert into public.student_lifecycle_events(
    student_id, event_type, effective_date, from_cohort_id, to_cohort_id, created_by
  ) values (
    target_student_id, event_value, effective_date, student_rec.current_cohort_id, student_rec.current_cohort_id, auth.uid()
  ) returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.set_student_status(uuid,text,date) from public;
grant execute on function public.set_student_status(uuid,text,date) to authenticated;

comment on function public.set_student_status(uuid,text,date) is
  'Sets the student lifecycle status using the six registry statuses. No reason is required; the effective date and audit event are recorded automatically.';

commit;
