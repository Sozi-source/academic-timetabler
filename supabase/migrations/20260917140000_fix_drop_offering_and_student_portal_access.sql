-- ============================================================================
-- Migration: Fix Drop Unit Offering & Student Portal Access Authorization
--
-- Problems:
--   1. Dropping a unit offering via set_unit_offering_approval() failed with:
--      "Some offerings were unavailable, outside the working department, or have locked sessions"
--      because:
--      a) The department check strictly required programme.department_id = active_department,
--         failing when a system admin or manager is authorized via current_user_can_manage_department().
--      b) The locked session check blocked dropping whenever any session was locked on the timetable,
--         even though an HOD dropping the unit intends to remove it from the cohort timetable.
--   2. Student Portal Access page (/students/access) crashed with "Something went wrong"
--      because get_student_portal_access_register() threw "No manageable active department is available"
--      when current_user_can_access_department() failed for system admins lacking active_department_id.
--
-- Fixes:
--   1. Update current_user_can_access_department() to allow system_admin unconditionally.
--   2. Update get_student_portal_access_register() to fall back to the first manageable department.
--   3. Update set_unit_offering_approval() to:
--      a) Accept any department the user can manage.
--      b) Safely cancel live timetable draft sessions for dropped units (matching unassign_teaching_allocation).
--      c) Return JSONB with detailed status and clear messaging.
-- ============================================================================

-- 1. Ensure system_admin can access all departments
create or replace function public.current_user_can_access_department(requested_department uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_has_role(array['system_admin']::public.app_role[])
    or (
      requested_department = (
        select profile.active_department_id
        from public.profiles profile
        where profile.id = auth.uid() and profile.is_active
      )
      and public.current_user_is_department_member(requested_department)
    );
$$;

-- 2. Resilient student portal access register
drop function if exists public.get_student_portal_access_register();

create or replace function public.get_student_portal_access_register()
returns table (
  student_id uuid,
  admission_number text,
  full_name text,
  programme_code text,
  cohort_name text,
  lifecycle_status text,
  has_credential boolean,
  is_active boolean,
  issued_at timestamptz,
  last_login_at timestamptz,
  failed_login_attempts integer,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_department uuid;
begin
  selected_department := coalesce(
    public.current_user_primary_department_id(),
    (
      select d.id from public.departments d
      where public.current_user_can_manage_department(d.id)
      order by d.created_at limit 1
    )
  );

  if selected_department is null
     or not public.current_user_can_manage_department(selected_department)
  then
    raise exception
      using errcode = '42501',
      message = 'No manageable active department is available';
  end if;

  return query
  select
    student.id,
    student.admission_number,
    student.full_name,
    programme.code,
    cohort.name,
    student.lifecycle_status::text,
    credential.student_id is not null,
    coalesce(credential.is_active, false),
    credential.issued_at,
    credential.last_login_at,
    coalesce(credential.failed_login_attempts, 0),
    credential.locked_until
  from public.students student
  join public.cohorts cohort on cohort.id = student.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  left join public.student_portal_credentials credential on credential.student_id = student.id
  where programme.department_id = selected_department
  order by cohort.name, student.admission_number;
end;
$$;

-- 3. Robust set_unit_offering_approval with graceful session handling
-- Drop existing function first because changing the return type (integer -> jsonb) is not allowed with CREATE OR REPLACE FUNCTION alone
drop function if exists public.set_unit_offering_approval(uuid[], boolean, text);

create or replace function public.set_unit_offering_approval(
  p_offering_ids uuid[],
  p_approve      boolean,
  p_reason       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  changed           integer := 0;
  clean_reason      text  := coalesce(
    nullif(trim(p_reason), ''),
    case when p_approve
      then null
      else 'Dropped from cohort teaching plan for this academic period'
    end
  );
  blocked_ids       uuid[];
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if coalesce(cardinality(p_offering_ids), 0) = 0 then
    raise exception 'Select at least one Unit on Offer';
  end if;

  if not p_approve and nullif(trim(p_reason), '') is null then
    raise exception 'Provide a reason when withdrawing an offering';
  end if;

  -- Identify offerings outside manageable departments
  select array_agg(o.id)
  into   blocked_ids
  from   public.unit_offerings o
  join   public.cohorts         c  on c.id  = o.cohort_id
  join   public.programmes      pr on pr.id = c.programme_id
  where  o.id = any(p_offering_ids)
    and  not (
      pr.department_id = active_department
      or public.current_user_can_manage_department(pr.department_id)
    );

  -- Update unblocked offerings
  update public.unit_offerings offering set
    approval_status      = case when p_approve
                             then 'approved'::public.unit_offering_approval_status
                             else 'withdrawn'::public.unit_offering_approval_status end,
    selection_state      = case when p_approve
                             then 'included'::public.unit_offering_selection_state
                             else 'excluded'::public.unit_offering_selection_state end,
    status               = case when p_approve
                             then 'draft'::public.unit_offering_status
                             else 'cancelled'::public.unit_offering_status end,
    is_timetable_enabled = p_approve
                           and offering.offering_type not in ('attachment', 'clinical_rotation', 'examination'),
    approved_by          = case when p_approve then auth.uid() else null end,
    approved_at          = case when p_approve then now()       else null end,
    withdrawn_by         = case when p_approve then null else auth.uid() end,
    withdrawn_at         = case when p_approve then null else now()       end,
    withdrawal_reason    = case when p_approve then null else clean_reason end,
    exception_reason     = case
                             when not p_approve
                               then coalesce(clean_reason, offering.exception_reason,
                                    'Dropped from cohort teaching plan for this academic period')
                             when p_approve and offering.origin = 'curriculum'
                               then offering.exception_reason
                             when p_approve and offering.origin <> 'curriculum'
                               then coalesce(offering.exception_reason, 'Approved cohort unit offering')
                             else offering.exception_reason
                           end,
    manually_reviewed    = true,
    reviewed_by          = auth.uid(),
    reviewed_at          = now(),
    updated_by           = auth.uid(),
    updated_at           = now()
  from public.cohorts      cohort
  join public.programmes   programme on programme.id = cohort.programme_id
  where offering.id = any(p_offering_ids)
    and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
    and offering.cohort_id = cohort.id
    and (
      programme.department_id = active_department
      or public.current_user_can_manage_department(programme.department_id)
    );

  get diagnostics changed = row_count;

  -- Cascade to allocations and scheduled sessions
  if p_approve then
    update public.teaching_allocations allocation
    set    source_unit_offering_id = offering.id,
           updated_by = auth.uid(),
           updated_at = now()
    from   public.unit_offerings offering
    where  offering.id = any(p_offering_ids)
      and  not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
      and  allocation.source_unit_offering_id is null
      and  allocation.academic_period_id = offering.academic_period_id
      and  allocation.cohort_id          = offering.cohort_id
      and  allocation.unit_id            = offering.unit_id
      and  (
             allocation.teaching_offering_id is null
             or exists (
               select 1 from public.teaching_offering_participants p
               where p.teaching_offering_id = allocation.teaching_offering_id
                 and p.unit_offering_id     = offering.id
             )
           );
  else
    -- When withdrawing, cancel live draft scheduled sessions for these offerings
    update public.scheduled_sessions session
    set
      status         = 'cancelled',
      conflict_state = 'clear',
      is_locked      = false,
      notes          = left(concat_ws(' ', nullif(trim(session.notes), ''), 'Cancelled because unit offering was dropped by HOD.'), 1000),
      updated_at     = now(),
      updated_by     = auth.uid()
    where session.teaching_allocation_id in (
      select id from public.teaching_allocations
      where source_unit_offering_id = any(p_offering_ids)
        and not (source_unit_offering_id = any(coalesce(blocked_ids, '{}'::uuid[])))
    )
    and session.status not in ('cancelled', 'archived');

    -- Suspend teaching allocations
    update public.teaching_allocations allocation
    set    is_timetable_enabled = false,
           status     = 'suspended',
           updated_by = auth.uid(),
           updated_at = now()
    where  allocation.source_unit_offering_id = any(p_offering_ids)
      and  not (allocation.source_unit_offering_id = any(coalesce(blocked_ids, '{}'::uuid[])))
      and  allocation.status in ('draft', 'active');
  end if;

  return jsonb_build_object(
    'changed',      changed,
    'blocked',      coalesce(cardinality(blocked_ids), 0),
    'blocked_ids',  coalesce(to_jsonb(blocked_ids), '[]'::jsonb),
    'message',      case
                      when coalesce(cardinality(blocked_ids), 0) = 0
                        then null
                      when changed = 0
                        then 'Offerings could not be updated because they belong to departments you cannot manage.'
                      else format(
                        '%s offering(s) updated. %s offering(s) were skipped because they belong to other departments.',
                        changed,
                        cardinality(blocked_ids)
                      )
                    end
  );
end;
$$;

revoke all on function public.set_unit_offering_approval(uuid[], boolean, text) from public;
grant  execute on function public.set_unit_offering_approval(uuid[], boolean, text) to authenticated;

revoke all on function public.get_student_portal_access_register() from public;
grant  execute on function public.get_student_portal_access_register() to authenticated;

