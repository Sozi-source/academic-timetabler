-- Migration: 20261110030000_update_record_of_work_practical_delivery_modes.sql
-- Description: Update Record of Work entries to ensure practical sessions use varied delivery methods
-- (such as Case Study, Video Presentation, Real Life Application Questions) instead of 'theory',
-- and set theory sessions to authentic didactic delivery labels.

-- 1. Explicitly update practical sessions for DHN 2304 / Biochemistry II (allocation 7f855ffc-9692-4577-ad9b-9948066aae3f)
UPDATE record_of_work_entries
SET delivery_mode = 'Case Study'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 1 AND session_number = 2;

UPDATE record_of_work_entries
SET delivery_mode = 'Video Presentation'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 2 AND session_number = 2;

UPDATE record_of_work_entries
SET delivery_mode = 'Real Life Application Questions'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 3 AND session_number = 2;

UPDATE record_of_work_entries
SET delivery_mode = 'Case Study'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 4 AND session_number = 2;

UPDATE record_of_work_entries
SET delivery_mode = 'Video Presentation'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 5 AND session_number = 2;

UPDATE record_of_work_entries
SET delivery_mode = 'Real Life Application Questions'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 6 AND session_number = 2;

UPDATE record_of_work_entries
SET delivery_mode = 'Case Study'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 7 AND session_number = 2;

UPDATE record_of_work_entries
SET delivery_mode = 'CAT Review & Guided Remediation'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 8 AND session_number = 2;

UPDATE record_of_work_entries
SET delivery_mode = 'Video Presentation'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 9 AND session_number = 2;

-- Update theory sessions (session 1) for Biochemistry II
UPDATE record_of_work_entries
SET delivery_mode = 'Interactive Lecture & Discussion'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND session_number = 1 AND week_number != 8;

UPDATE record_of_work_entries
SET delivery_mode = 'Continuous Assessment Test'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND session_number = 1 AND week_number = 8;

-- 2. General update across ALL practical rows in record_of_work_entries
-- Ensures practical rows never have 'theory' and vary methods across weeks
UPDATE record_of_work_entries
SET delivery_mode = CASE ((COALESCE(week_number, 1) - 1) % 3)
  WHEN 0 THEN 'Case Study'
  WHEN 1 THEN 'Video Presentation'
  ELSE 'Real Life Application Questions'
END
WHERE (topic_covered ILIKE '%practical%' OR session_number > 1)
  AND (delivery_mode ILIKE '%theory%' OR delivery_mode ILIKE '%lecture%' OR delivery_mode = 'practical' OR delivery_mode IS NULL);
