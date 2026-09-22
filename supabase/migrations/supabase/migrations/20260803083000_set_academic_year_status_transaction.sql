begin;

create or replace function public.set_academic_year_status(
  p_academic_year_id uuid,
  p_status text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status public.academic_years.status%type;
begin
  if p_status not in (
    'planned',
    'active',
    'closed',
    'archived'
  ) then
    raise exception
      'Unsupported Academic Year status: %',
      p_status
      using errcode = '22023';
  end if;

  /*
   * Convert the incoming text using the real column type.
   * This remains compatible whether status is an enum
   * or another constrained PostgreSQL type.
   */
  select
    (
      jsonb_populate_record(
        null::public.academic_years,
        jsonb_build_object(
          'status',
          p_status
        )
      )
    ).status
  into v_status;

  /*
   * Serialize Academic Year activation operations.
   * This prevents two concurrent requests from creating
   * competing active years.
   */
  perform pg_advisory_xact_lock(
    hashtext(
      'public.academic_years.active-status'
    )
  );

  if not exists (
    select 1
    from public.academic_years
    where id = p_academic_year_id
  ) then
    raise exception
      'Academic Year was not found.'
      using errcode = 'P0002';
  end if;

  if p_status = 'active' then
    update public.academic_years
    set
      status = (
        jsonb_populate_record(
          null::public.academic_years,
          jsonb_build_object(
            'status',
            'closed'
          )
        )
      ).status,
      updated_at = now()
    where status::text = 'active'
      and id <> p_academic_year_id;
  end if;

  update public.academic_years
  set
    status = v_status,
    updated_at = now()
  where id = p_academic_year_id;
end;
$$;

revoke all
on function public.set_academic_year_status(
  uuid,
  text
)
from public;

grant execute
on function public.set_academic_year_status(
  uuid,
  text
)
to authenticated;

commit;