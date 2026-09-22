-- Preserve normal Record of Work immutability while allowing the explicit,
-- system-admin-only timetable clean-slate transaction.

create or replace function public.protect_submitted_record_of_work()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  authorized_reset boolean :=
    coalesce(current_setting('app.allow_timetable_history_reset', true), '') = 'on'
    and public.current_user_has_role(array['system_admin']::public.app_role[]);
begin
  if auth.role() <> 'service_role'
    and not authorized_reset
    and old.status = 'submitted'
  then
    raise exception
      'Submitted Record of Work entries are immutable.'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.clear_department_timetable_history_authorized(
  target_academic_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.current_user_has_role(array['system_admin']::public.app_role[]) then
    raise exception using
      errcode = '42501',
      message = 'Only a system administrator may permanently clear submitted teaching records';
  end if;

  perform set_config('app.allow_timetable_history_reset', 'on', true);

  return public.clear_department_timetable_history_complete(
    target_academic_period_id
  );
end;
$$;

revoke all on function public.clear_department_timetable_history_authorized(uuid) from public;
grant execute on function public.clear_department_timetable_history_authorized(uuid) to authenticated;

comment on function public.clear_department_timetable_history_authorized(uuid) is
  'System-admin-only entry point for the explicit complete timetable reset; temporarily authorizes deletion of submitted Record of Work entries inside the same transaction.';
