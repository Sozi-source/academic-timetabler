begin;

create table if not exists public.scheduling_constraints (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references public.academic_periods(id) on delete cascade,
  subject_type text not null check (subject_type in ('trainer','room','cohort','institution')),
  subject_id uuid,
  constraint_type text not null check (constraint_type in ('unavailable','preferred','required','protected_day')),
  working_day_id uuid references public.working_days(id) on delete cascade,
  starts_at time,
  ends_at time,
  priority text not null default 'hard' check (priority in ('hard','soft')),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduling_constraints_subject_check check (
    (subject_type = 'institution' and subject_id is null)
    or (subject_type <> 'institution' and subject_id is not null)
  ),
  constraint scheduling_constraints_time_check check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and starts_at < ends_at)
  )
);

create index if not exists scheduling_constraints_period_idx
  on public.scheduling_constraints(academic_period_id, is_active);
create index if not exists scheduling_constraints_subject_idx
  on public.scheduling_constraints(subject_type, subject_id);

alter table public.scheduling_constraints enable row level security;

drop policy if exists scheduling_constraints_read on public.scheduling_constraints;
create policy scheduling_constraints_read on public.scheduling_constraints
for select to authenticated using (true);

drop policy if exists scheduling_constraints_manage on public.scheduling_constraints;
create policy scheduling_constraints_manage on public.scheduling_constraints
for all to authenticated
using (public.current_user_has_role(array['hod','system_admin']::public.app_role[]))
with check (public.current_user_has_role(array['hod','system_admin']::public.app_role[]));

grant select, insert, update, delete on public.scheduling_constraints to authenticated;

create or replace function public.touch_scheduling_constraint()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists scheduling_constraints_touch on public.scheduling_constraints;
create trigger scheduling_constraints_touch
before update on public.scheduling_constraints
for each row execute function public.touch_scheduling_constraint();

commit;
