-- ============================================================================
-- Migration: Phased CAT and Exam Marks Entry Control
--
-- Adds:
--   - public.assessment_events.trainer_cat_entry_open (boolean)
--   - public.assessment_events.trainer_exam_entry_open (boolean)
--   - Updates public.set_department_trainer_entry(uuid, boolean, text)
--
-- Purpose:
--   Separates Continuous Assessment (CAT) mark entry window from Final Examination
--   mark entry window. Prevents trainers from entering or submitting final exam
--   marks prematurely during mid-term CAT entry.
-- ============================================================================

alter table public.assessment_events
  add column if not exists trainer_cat_entry_open boolean not null default false;

alter table public.assessment_events
  add column if not exists trainer_exam_entry_open boolean not null default false;

-- Backfill: existing open markbooks have CAT entry open, exam entry closed
update public.assessment_events
set trainer_cat_entry_open = coalesce(trainer_entry_open, false),
    trainer_exam_entry_open = false
where trainer_cat_entry_open is false and trainer_entry_open is true;

comment on column public.assessment_events.trainer_cat_entry_open is
  'When true, trainers can enter and submit Continuous Assessment (Assignment, Presentation, RAT, CAT) marks.';

comment on column public.assessment_events.trainer_exam_entry_open is
  'When true, trainers can enter and submit Final Examination marks. Kept false until official exam period.';

-- Overloaded / upgraded function to support phased component gating
create or replace function public.set_department_trainer_entry(
  p_academic_period_id uuid,
  p_should_open boolean,
  p_component text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
  v_updated_count integer := 0;
  v_target_comp text := lower(coalesce(p_component, 'all'));
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
        null;
      end;
    end loop;
  end if;

  -- Update based on targeted component: 'cat', 'exam', or 'all'
  if v_target_comp = 'cat' then
    update public.assessment_events
    set trainer_cat_entry_open = p_should_open,
        trainer_entry_open = (p_should_open or trainer_exam_entry_open),
        updated_at = now()
    where department_id = v_department_id
      and academic_period_id = p_academic_period_id
      and title = 'Unit Markbook'
      and assessment_type = 'exam'
      and status <> 'closed';
  elsif v_target_comp = 'exam' then
    update public.assessment_events
    set trainer_exam_entry_open = p_should_open,
        trainer_entry_open = (trainer_cat_entry_open or p_should_open),
        updated_at = now()
    where department_id = v_department_id
      and academic_period_id = p_academic_period_id
      and title = 'Unit Markbook'
      and assessment_type = 'exam'
      and status <> 'closed';
  else
    -- 'all'
    update public.assessment_events
    set trainer_cat_entry_open = p_should_open,
        trainer_exam_entry_open = p_should_open,
        trainer_entry_open = p_should_open,
        updated_at = now()
    where department_id = v_department_id
      and academic_period_id = p_academic_period_id
      and title = 'Unit Markbook'
      and assessment_type = 'exam'
      and status <> 'closed';
  end if;

  get diagnostics v_updated_count = row_count;

  -- When closing all components, re-sync rosters
  if not p_should_open and v_target_comp = 'all' then
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
    'component', v_target_comp,
    'updatedCount', v_updated_count
  );
end;
$$;
