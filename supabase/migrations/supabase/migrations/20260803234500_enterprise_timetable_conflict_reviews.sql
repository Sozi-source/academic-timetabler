begin;

create table if not exists public.timetable_conflict_reviews (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete cascade,
  conflict_key text not null,
  status text not null
    check (status in ('acknowledged', 'resolved', 'reopened')),
  resolution_note text,
  reviewed_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_conflict_reviews_key_length_check
    check (char_length(conflict_key) between 3 and 500),
  constraint timetable_conflict_reviews_note_length_check
    check (resolution_note is null or char_length(resolution_note) between 3 and 1000),
  unique (academic_period_id, conflict_key)
);

create index if not exists timetable_conflict_reviews_period_status_idx
  on public.timetable_conflict_reviews(academic_period_id, status);

alter table public.timetable_conflict_reviews enable row level security;

drop policy if exists timetable_conflict_reviews_read on public.timetable_conflict_reviews;
create policy timetable_conflict_reviews_read
on public.timetable_conflict_reviews
for select to authenticated
using (true);

drop policy if exists timetable_conflict_reviews_manage on public.timetable_conflict_reviews;
create policy timetable_conflict_reviews_manage
on public.timetable_conflict_reviews
for all to authenticated
using (
  public.current_user_has_role(
    array['hod', 'system_admin']::public.app_role[]
  )
)
with check (
  public.current_user_has_role(
    array['hod', 'system_admin']::public.app_role[]
  )
);

grant select, insert, update, delete
on public.timetable_conflict_reviews
to authenticated;

create or replace function public.touch_timetable_conflict_review()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.reviewed_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists timetable_conflict_reviews_touch
on public.timetable_conflict_reviews;

create trigger timetable_conflict_reviews_touch
before update on public.timetable_conflict_reviews
for each row execute function public.touch_timetable_conflict_review();

commit;
