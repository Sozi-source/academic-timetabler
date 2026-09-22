-- Match workload totals to the authoritative allocation register. Legacy
-- allocations whose source offering still requires approval must not consume
-- trainer capacity or produce overload warnings.

create or replace function public.get_institution_trainer_workloads(
  target_academic_period_id uuid
)
returns table (
  trainer_id uuid,
  allocated_hours numeric,
  department_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  with active_allocations as (
    select allocation.*
    from public.teaching_allocations allocation
    join public.unit_offerings source_offering
      on source_offering.id = allocation.source_unit_offering_id
    where allocation.academic_period_id = target_academic_period_id
      and allocation.trainer_id is not null
      and allocation.status in ('draft', 'active')
      and source_offering.approval_status = 'approved'
      and source_offering.selection_state = 'included'
      and source_offering.is_timetable_enabled
  ), deliveries as (
    select allocation.trainer_id,
      coalesce(allocation.teaching_offering_id, allocation.id) as delivery_id,
      max(allocation.weekly_sessions * allocation.session_duration_minutes) as weekly_minutes
    from active_allocations allocation
    group by allocation.trainer_id,
      coalesce(allocation.teaching_offering_id, allocation.id)
  ), trainer_hours as (
    select delivery.trainer_id,
      coalesce(sum(delivery.weekly_minutes) / 60.0, 0)::numeric as allocated_hours
    from deliveries delivery
    group by delivery.trainer_id
  ), trainer_departments as (
    select allocation.trainer_id,
      count(distinct programme.department_id) as department_count
    from active_allocations allocation
    join public.cohorts cohort on cohort.id = allocation.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    group by allocation.trainer_id
  )
  select hours.trainer_id, hours.allocated_hours, departments.department_count
  from trainer_hours hours
  join trainer_departments departments on departments.trainer_id = hours.trainer_id;
end;
$$;

revoke all on function public.get_institution_trainer_workloads(uuid) from public;
grant execute on function public.get_institution_trainer_workloads(uuid) to authenticated;

comment on function public.get_institution_trainer_workloads(uuid) is
  'Aggregates approved institution-wide trainer workloads by unique delivery, counting shared-class participant rows once.';
