-- Migration: 20260912204500_purge_draft_teaching_allocations.sql
-- Description: Purge unreferenced archived and draft teaching allocations,
-- leaving only approved and active timetable units.

delete from public.teaching_allocations ta
where (ta.is_timetable_enabled = false or ta.status in ('archived', 'draft'))
  and not exists (
    select 1 from public.scheduled_sessions ss
    where ss.teaching_allocation_id = ta.id
  )
  and not exists (
    select 1 from public.class_sessions cs
    where cs.teaching_allocation_id = ta.id
  )
  and not exists (
    select 1 from public.teaching_documents td
    where td.allocation_id = ta.id
  );
