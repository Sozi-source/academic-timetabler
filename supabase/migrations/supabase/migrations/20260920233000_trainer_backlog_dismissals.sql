-- Migration: 20260920233000_trainer_backlog_dismissals.sql
-- Description:
--   Lets a trainer explicitly dismiss/hide a stale "Overdue Attendance &
--   Reports" backlog item (e.g. a historical date the resilient multi-key
--   matching still can't reconcile) without needing to force a report
--   submission through it. Purely additive — records nothing about
--   attendance itself, only that the trainer has acknowledged and hidden
--   the reminder for that date.

begin;

create table if not exists public.trainer_backlog_dismissals (
  trainer_id uuid not null
    references public.trainers(id)
    on delete cascade,

  report_date date not null,

  dismissed_at timestamptz not null
    default now(),

  dismissed_by uuid
    references auth.users(id)
    on delete set null,

  constraint trainer_backlog_dismissals_pkey
    primary key (trainer_id, report_date)
);

alter table public.trainer_backlog_dismissals enable row level security;

drop policy if exists trainer_backlog_dismissals_select_own on public.trainer_backlog_dismissals;
create policy trainer_backlog_dismissals_select_own
  on public.trainer_backlog_dismissals
  for select
  to authenticated
  using (
    exists (
      select 1 from public.trainers t
      where t.id = trainer_backlog_dismissals.trainer_id
        and t.profile_id = auth.uid()
    )
    or public.current_user_has_role(array['hod', 'system_admin']::public.app_role[])
  );

drop policy if exists trainer_backlog_dismissals_insert_own on public.trainer_backlog_dismissals;
create policy trainer_backlog_dismissals_insert_own
  on public.trainer_backlog_dismissals
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.trainers t
      where t.id = trainer_backlog_dismissals.trainer_id
        and t.profile_id = auth.uid()
    )
  );

commit;
