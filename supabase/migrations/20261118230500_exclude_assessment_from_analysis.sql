-- Allow HODs to exclude non-exam or testing unit markbooks (e.g., Trade Project)
-- from CAT & Exam analysis and period report aggregations.
alter table public.assessment_events
  add column if not exists exclude_from_analysis boolean not null default false;

comment on column public.assessment_events.exclude_from_analysis is
  'When true, this markbook is excluded from CAT & Exam analysis and consolidated period reports.';
