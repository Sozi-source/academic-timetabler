-- HOD-confirmed shared classes for equivalent units across programmes.

alter table public.unit_offerings
  add column if not exists confirmed_shared_offering_id uuid
  references public.teaching_offerings(id) on delete restrict;

alter table public.teaching_allocations
  add column if not exists participant_cohort_ids uuid[] not null default '{}',
  add column if not exists combined_cohort_size integer not null default 0;
update public.teaching_allocations set participant_cohort_ids=array[cohort_id]
  where cardinality(participant_cohort_ids)=0;

alter table public.scheduled_sessions
  add column if not exists participant_cohort_ids uuid[] not null default '{}',
  add column if not exists combined_cohort_size integer not null default 0;

create or replace function public.set_shared_session_context()
returns trigger language plpgsql security invoker set search_path='' as $$
declare a public.teaching_allocations%rowtype;
begin
  select * into a from public.teaching_allocations where id=new.teaching_allocation_id;
  new.participant_cohort_ids:=case when cardinality(a.participant_cohort_ids)>0 then a.participant_cohort_ids else array[a.cohort_id] end;
  new.combined_cohort_size:=a.combined_cohort_size;
  return new;
end $$;
drop trigger if exists scheduled_sessions_shared_context on public.scheduled_sessions;
create trigger scheduled_sessions_shared_context before insert or update of teaching_allocation_id
  on public.scheduled_sessions for each row execute function public.set_shared_session_context();

create index if not exists unit_offerings_confirmed_shared_idx
  on public.unit_offerings(confirmed_shared_offering_id)
  where confirmed_shared_offering_id is not null;

create or replace function public.confirm_shared_unit_offerings(p_offering_ids uuid[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_count integer; v_period_count integer; v_title_count integer;
  v_pattern_count integer; v_period uuid; v_title text; v_group uuid; v_key text;
begin
  select count(*),count(distinct o.academic_period_id),
    count(distinct lower(regexp_replace(trim(u.name),'[^a-z0-9]+',' ','gi'))),
    count(distinct concat(coalesce(o.weekly_sessions,u.weekly_sessions),':',coalesce(o.session_duration_minutes,120))),
    (array_agg(o.academic_period_id))[1],min(u.name)
  into v_count,v_period_count,v_title_count,v_pattern_count,v_period,v_title
  from public.unit_offerings o join public.units u on u.id=o.unit_id
  where o.id=any(p_offering_ids) and o.allocation_status='unallocated';
  if v_count < 2 then raise exception 'Select at least two unallocated units'; end if;
  if v_count <> cardinality(p_offering_ids) then raise exception 'One or more selected units are unavailable or already allocated'; end if;
  if v_period_count<>1 then raise exception 'Shared units must belong to the same Academic Period'; end if;
  if v_title_count<>1 then raise exception 'Only units with the same normalized title can be combined'; end if;
  if v_pattern_count<>1 then raise exception 'Shared units must have the same weekly sessions and duration'; end if;
  if exists(select 1 from public.unit_offerings o where o.id=any(p_offering_ids) and o.confirmed_shared_offering_id is not null)
    then raise exception 'One or more units already belong to a confirmed shared class'; end if;
  if exists(select 1 from public.unit_offerings o where o.id=any(p_offering_ids) and o.fixed_schedule_required)
     and (select count(distinct concat(o.fixed_working_day_id,':',o.fixed_time_slot_id)) from public.unit_offerings o where o.id=any(p_offering_ids))<>1
    then raise exception 'Fixed day and session must match for every shared unit'; end if;
  v_key := 'CONFIRMED-'||upper(substr(md5(array_to_string((select array_agg(x order by x) from unnest(p_offering_ids) x),',')),1,20));
  insert into public.teaching_offerings(academic_period_id,title,shared_class_key,weekly_sessions,session_duration_minutes,status,is_timetable_enabled,notes)
  select v_period,v_title,v_key,coalesce(o.weekly_sessions,u.weekly_sessions),coalesce(o.session_duration_minutes,120),'draft',true,'HOD-confirmed shared class'
  from public.unit_offerings o join public.units u on u.id=o.unit_id where o.id=p_offering_ids[1]
  returning id into v_group;
  insert into public.teaching_offering_participants(teaching_offering_id,cohort_id,unit_id,unit_offering_id,is_primary,notes)
  select v_group,o.cohort_id,o.unit_id,o.id,row_number() over(order by o.id)=1,'Confirmed equivalent unit'
  from public.unit_offerings o where o.id=any(p_offering_ids);
  update public.unit_offerings set confirmed_shared_offering_id=v_group,manually_reviewed=true,reviewed_by=auth.uid(),reviewed_at=now()
  where id=any(p_offering_ids);
  return v_group;
end $$;

grant execute on function public.confirm_shared_unit_offerings(uuid[]) to authenticated;

create or replace function public.assign_unit_offering(p_offering_id uuid,p_trainer_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.unit_offerings%rowtype; t public.trainers%rowtype; g public.teaching_offerings%rowtype;
  used_hours numeric; added_hours numeric; projected numeric; allocation_id uuid;
begin
  select * into o from public.unit_offerings where id=p_offering_id for update;
  if o.id is null then raise exception 'Unit on offer was not found'; end if;
  if o.allocation_status='allocated' then raise exception 'This unit on offer is already allocated'; end if;
  select * into t from public.trainers where id=p_trainer_id;
  if t.id is null or not t.is_active or not t.is_timetable_available then raise exception 'The selected trainer is not available'; end if;
  if o.confirmed_shared_offering_id is not null then
    select * into g from public.teaching_offerings where id=o.confirmed_shared_offering_id;
    if exists(select 1 from public.teaching_offering_participants p where p.teaching_offering_id=g.id
      and exists(select 1 from public.trainer_unit_eligibility e where e.unit_id=p.unit_id)
      and not exists(select 1 from public.trainer_unit_eligibility e where e.unit_id=p.unit_id and e.trainer_id=t.id))
      then raise exception 'The trainer is not approved for every unit in this shared class'; end if;
    added_hours:=g.weekly_sessions*g.session_duration_minutes/60.0;
  else
    added_hours:=coalesce(o.weekly_sessions,1)*coalesce(o.session_duration_minutes,120)/60.0;
  end if;
  select coalesce(sum(weekly_sessions*session_duration_minutes)/60.0,0) into used_hours from public.teaching_allocations
    where trainer_id=t.id and academic_period_id=o.academic_period_id and status in('draft','active');
  projected:=used_hours+added_hours;
  if projected>t.maximum_weekly_hours then raise exception 'Maximum workload exceeded: %h projected, %h maximum',projected,t.maximum_weekly_hours; end if;
  insert into public.teaching_allocations(academic_period_id,cohort_id,unit_id,trainer_id,delivery_mode,weekly_sessions,session_duration_minutes,status,is_timetable_enabled,teaching_offering_id,participant_cohort_ids,combined_cohort_size,notes)
  values(o.academic_period_id,o.cohort_id,o.unit_id,t.id,case when o.offering_type='practical' then 'practical'::public.teaching_delivery_mode else 'theory'::public.teaching_delivery_mode end,
    case when g.id is null then coalesce(o.weekly_sessions,1) else g.weekly_sessions end,
    case when g.id is null then coalesce(o.session_duration_minutes,120) else g.session_duration_minutes end,
    'active',true,g.id,
    case when g.id is null then array[o.cohort_id] else (select array_agg(distinct p.cohort_id) from public.teaching_offering_participants p where p.teaching_offering_id=g.id) end,
    case when g.id is null then (select c.actual_size from public.cohorts c where c.id=o.cohort_id) else (select coalesce(sum(c.actual_size),0) from public.teaching_offering_participants p join public.cohorts c on c.id=p.cohort_id where p.teaching_offering_id=g.id) end,
    case when g.id is null then null else 'Shared class: workload counted once' end)
  returning id into allocation_id;
  if g.id is not null then
    update public.teaching_offerings set trainer_id=t.id,status='active' where id=g.id;
    update public.unit_offerings set allocation_status='allocated',status='active',updated_at=now() where confirmed_shared_offering_id=g.id;
  else
    update public.unit_offerings set allocation_status='allocated',status='active',updated_at=now() where id=o.id;
  end if;
  return jsonb_build_object('allocationId',allocation_id,'allocatedHours',projected,'normalHours',t.normal_weekly_hours,
    'maximumHours',t.maximum_weekly_hours,'isExtraLoad',projected>t.normal_weekly_hours,'shared',g.id is not null);
end $$;

comment on function public.confirm_shared_unit_offerings(uuid[]) is
  'Requires explicit HOD confirmation before equivalent programme units become one shared schedulable class.';
