-- Department registry category requested for students who left studies and require follow-up.
alter type public.student_lifecycle_status add value if not exists 'dropped_out';
alter type public.student_lifecycle_event_type add value if not exists 'dropout';
alter type public.student_academic_phase add value if not exists 'dropped_out';
