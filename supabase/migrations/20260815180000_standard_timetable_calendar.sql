-- Institution-wide timetable pattern, materialized per Academic Period so
-- existing foreign keys and historical timetables remain stable.

create or replace function public.initialize_standard_timetable_calendar(p_academic_period_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare day_count integer:=0; slot_count integer:=0;
begin
  if not exists(select 1 from public.academic_periods where id=p_academic_period_id and status<>'archived')
    then raise exception 'The Academic Period is missing or archived'; end if;

  insert into public.working_days(academic_period_id,day_of_week,sequence_number,is_enabled,notes)
  select p_academic_period_id,v.day::public.weekday_code,v.seq,true,'Standard institutional teaching day'
  from (values ('monday',1),('tuesday',2),('wednesday',3),('thursday',4),('friday',5),('saturday',6)) v(day,seq)
  where not exists(select 1 from public.working_days d where d.academic_period_id=p_academic_period_id and d.day_of_week=v.day::public.weekday_code);
  get diagnostics day_count=row_count;

  if not exists(select 1 from public.time_slots where academic_period_id=p_academic_period_id) then
    insert into public.time_slots(academic_period_id,name,code,slot_type,starts_at,ends_at,sequence_number,is_enabled,notes)
    values
      (p_academic_period_id,'Morning','AM','teaching','08:00','10:00',1,true,'Standard teaching session'),
      (p_academic_period_id,'Mid-morning','MM','teaching','10:30','12:30',2,true,'Standard teaching session'),
      (p_academic_period_id,'Afternoon','PM','teaching','14:00','16:00',3,true,'Standard teaching session');
    get diagnostics slot_count=row_count;
  end if;

  return jsonb_build_object('workingDaysCreated',day_count,'teachingSessionsCreated',slot_count);
end $$;

grant execute on function public.initialize_standard_timetable_calendar(uuid) to authenticated;

comment on function public.initialize_standard_timetable_calendar(uuid) is
  'Initializes Monday-Saturday and the standard 08:00, 10:30 and 14:00 teaching sessions for an Academic Period without duplicating existing configuration.';
