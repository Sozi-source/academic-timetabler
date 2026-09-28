-- ----------------------------------------------------------------------------
-- 20260928062500_auto_approve_trainer_confirmed_documents.sql
-- Auto-approves all trainer-confirmed teaching documents for direct QA ZIP download.
-- Fixes current_user_can_manage_teaching_allocation department resolution.
-- ----------------------------------------------------------------------------

-- 1. Auto-approve all existing submitted teaching documents so they are immediately available for QA download
update public.teaching_documents
set
  status = 'approved',
  approved_at = coalesce(approved_at, submitted_at, now()),
  approved_revision_number = coalesce(approved_revision_number, submitted_revision_number, current_revision_number, 1),
  updated_at = now()
where status = 'submitted';

-- 2. Record review approval records for documents that do not have one
insert into public.teaching_document_reviews (
  document_id,
  revision_number,
  decision,
  note,
  reviewed_at
)
select
  doc.id,
  coalesce(doc.approved_revision_number, 1),
  'approved',
  'Confirmed by trainer and approved for QA download',
  coalesce(doc.approved_at, now())
from public.teaching_documents as doc
where doc.status = 'approved'
  and not exists (
    select 1
    from public.teaching_document_reviews as rev
    where rev.document_id = doc.id
      and rev.decision = 'approved'
  );

-- 3. Fix allocation department check function so allocation.id joins with cohorts properly
create or replace function public.current_user_can_manage_teaching_allocation(
  target_allocation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.teaching_allocations as allocation
    join public.cohorts as cohort on cohort.id = allocation.cohort_id
    join public.programmes as programme on programme.id = cohort.programme_id
    where allocation.id = target_allocation_id
      and (
        public.current_user_has_role(array['system_admin']::public.app_role[])
        or public.current_user_can_manage_department(programme.department_id)
      )
  );
$$;

revoke all on function public.current_user_can_manage_teaching_allocation(uuid) from public;
grant execute on function public.current_user_can_manage_teaching_allocation(uuid) to authenticated;
