-- ============================================================
-- Teaching Offering access policies
-- ============================================================

revoke all
on table public.teaching_offerings
from anon;

revoke all
on table public.teaching_offerings
from authenticated;

grant select, insert, update
on table public.teaching_offerings
to authenticated;

create policy
  "Authorized staff can view teaching offerings"
on public.teaching_offerings
for select
to authenticated
using (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
);

create policy
  "Authorized staff can create teaching offerings"
on public.teaching_offerings
for insert
to authenticated
with check (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
  and created_by = (select auth.uid())
);

create policy
  "Authorized staff can update teaching offerings"
on public.teaching_offerings
for update
to authenticated
using (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
)
with check (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
);

-- ------------------------------------------------------------
-- Participant access
-- ------------------------------------------------------------

revoke all
on table public.teaching_offering_participants
from anon;

revoke all
on table public.teaching_offering_participants
from authenticated;

grant select, insert, update
on table public.teaching_offering_participants
to authenticated;

create policy
  "Authorized staff can view offering participants"
on public.teaching_offering_participants
for select
to authenticated
using (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
);

create policy
  "Authorized staff can create offering participants"
on public.teaching_offering_participants
for insert
to authenticated
with check (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
  and created_by = (select auth.uid())
);

create policy
  "Authorized staff can update offering participants"
on public.teaching_offering_participants
for update
to authenticated
using (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
)
with check (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
);

-- No DELETE policies are intentionally provided.
-- Offerings and participants form part of academic and
-- timetable history and should be deactivated instead.