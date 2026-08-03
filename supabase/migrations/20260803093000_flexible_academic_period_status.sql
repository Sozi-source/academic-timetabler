begin;

create or replace function public.set_academic_period_status(
  p_period_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academic_year_id uuid;
  v_period_status public.academic_periods.status%type;
  v_year_active_status public.academic_years.status%type;
  v_year_closed_status public.academic_years.status%type;
  v_period_closed_status public.academic_periods.status%type;
begin
  if p_status not in (
    'planned',
    'active',
    'closed',
    'archived'
  ) then
    raise exception
      'Unsupported Academic Period status: %',
      p_status
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(
      'public.academic-period-status'
    )
  );

  select academic_year_id
  into v_academic_year_id
  from public.academic_periods
  where id = p_period_id
  for update;

  if v_academic_year_id is null then
    raise exception
      'Academic Period was not found.'
      using errcode = 'P0002';
  end if;

  select (
    jsonb_populate_record(
      null::public.academic_periods,
      jsonb_build_object(
        'status',
        p_status
      )
    )
  ).status
  into v_period_status;

  select (
    jsonb_populate_record(
      null::public.academic_periods,
      jsonb_build_object(
        'status',
        'closed'
      )
    )
  ).status
  into v_period_closed_status;

  select (
    jsonb_populate_record(
      null::public.academic_years,
      jsonb_build_object(
        'status',
        'active'
      )
    )
  ).status
  into v_year_active_status;

  select (
    jsonb_populate_record(
      null::public.academic_years,
      jsonb_build_object(
        'status',
        'closed'
      )
    )
  ).status
  into v_year_closed_status;

  if p_status = 'active' then
    /*
     * Close the previously active period first.
     */
    update public.academic_periods
    set
      status = v_period_closed_status,
      updated_at = now()
    where status::text = 'active'
      and id <> p_period_id;

    /*
     * Keep the active Academic Year consistent with
     * the Academic Period being activated.
     */
    update public.academic_years
    set
      status = v_year_closed_status,
      updated_at = now()
    where status::text = 'active'
      and id <> v_academic_year_id;

    update public.academic_years
    set
      status = v_year_active_status,
      updated_at = now()
    where id = v_academic_year_id;
  end if;

  /*
   * Some older lifecycle rules require an active period
   * to be closed before it can be archived.
   */
  if p_status = 'archived' then
    update public.academic_periods
    set
      status = v_period_closed_status,
      updated_at = now()
    where id = p_period_id
      and status::text = 'active';
  end if;

  update public.academic_periods
  set
    status = v_period_status,
    updated_at = now()
  where id = p_period_id;
end;
$$;

revoke all
on function public.set_academic_period_status(
  uuid,
  text
)
from public;

grant execute
on function public.set_academic_period_status(
  uuid,
  text
)
to authenticated;

commit;