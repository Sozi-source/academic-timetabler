-- ============================================================
-- HND App: Academic Period lifecycle transitions
-- ============================================================

create or replace function
  public.set_academic_period_status(
    period_id uuid,
    new_status public.academic_period_status
  )
returns public.academic_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_period public.academic_periods;
  updated_period public.academic_periods;
  parent_year_status public.academic_year_status;
begin
  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'You are not authorized to update Academic Periods';
  end if;

  select *
  into current_period
  from public.academic_periods
  where id = period_id
  for update;

  if current_period.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Academic Period not found';
  end if;

  if current_period.status = 'archived' then
    raise exception using
      errcode = 'P0001',
      message = 'Archived Academic Periods cannot be changed';
  end if;

  if
    current_period.status = 'active'
    and new_status = 'archived'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Close the active Academic Period before archiving it';
  end if;

  if new_status = 'active' then
    select status
    into parent_year_status
    from public.academic_years
    where id = current_period.academic_year_id
    for update;

    if parent_year_status <> 'active' then
      raise exception using
        errcode = 'P0001',
        message = 'The parent Academic Year must be active first';
    end if;

    update public.academic_periods
    set status = 'closed'
    where status = 'active'
      and id <> period_id;
  end if;

  update public.academic_periods
  set
    status = new_status,
    updated_by = auth.uid(),
    updated_at = now()
  where id = period_id
  returning *
  into updated_period;

  return updated_period;
end;
$$;

revoke all
on function public.set_academic_period_status(
  uuid,
  public.academic_period_status
)
from public;

grant execute
on function public.set_academic_period_status(
  uuid,
  public.academic_period_status
)
to authenticated;

comment on function public.set_academic_period_status(
  uuid,
  public.academic_period_status
) is
  'Performs authorized and atomic Academic Period lifecycle transitions.';