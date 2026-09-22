-- Shared-class membership is live timetable state. Historical, suspended and
-- archived allocations must not be rewritten when a class is combined: doing
-- so invokes scheduled-session validation against an allocation that is no
-- longer schedulable. Keep participant propagation on the editable live draft
-- while preserving inactive allocation/session history unchanged.

create or replace function public.sync_allocation_participants_to_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('draft', 'active')
    or not new.is_timetable_enabled then
    return new;
  end if;

  update public.scheduled_sessions session
  set
    participant_cohort_ids = new.participant_cohort_ids,
    combined_cohort_size = new.combined_cohort_size,
    updated_at = now(),
    updated_by = auth.uid()
  where session.teaching_allocation_id = new.id
    and session.status in ('draft', 'confirmed', 'locked')
    and (
      session.participant_cohort_ids
        is distinct from new.participant_cohort_ids
      or session.combined_cohort_size
        is distinct from new.combined_cohort_size
    );

  return new;
end;
$$;

create or replace function public.refresh_shared_class_participant_context(
  p_teaching_offering_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_teaching_offering_id is null then
    return;
  end if;

  update public.teaching_allocations allocation
  set
    participant_cohort_ids =
      public.resolve_participant_cohort_ids(
        allocation.cohort_id,
        allocation.teaching_offering_id
      ),
    combined_cohort_size =
      public.resolve_participant_cohort_size(
        public.resolve_participant_cohort_ids(
          allocation.cohort_id,
          allocation.teaching_offering_id
        )
      ),
    updated_at = now(),
    updated_by = auth.uid()
  where allocation.teaching_offering_id = p_teaching_offering_id
    and allocation.status in ('draft', 'active')
    and allocation.is_timetable_enabled
    and (
      allocation.participant_cohort_ids is distinct from
        public.resolve_participant_cohort_ids(
          allocation.cohort_id,
          allocation.teaching_offering_id
        )
      or allocation.combined_cohort_size is distinct from
        public.resolve_participant_cohort_size(
          public.resolve_participant_cohort_ids(
            allocation.cohort_id,
            allocation.teaching_offering_id
          )
        )
    );
end;
$$;

comment on function public.sync_allocation_participants_to_sessions() is
  'Synchronizes participant cohorts only to live draft sessions of a schedulable allocation; inactive history remains immutable.';

comment on function public.refresh_shared_class_participant_context(uuid) is
  'Refreshes shared-class participant context only for draft or active timetable-enabled allocations.';
