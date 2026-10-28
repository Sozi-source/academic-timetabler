-- Migration: Fix assessment_event_type enum to include 'unit_markbook'
-- Fixes error: "invalid input value for enum assessment_event_type: 'unit_markbook'"
-- The operational_assessment_type computed column (or a DB view/function) emits
-- 'unit_markbook' for Unit Markbook assessment events. This value must exist in the
-- enum before the view/column can be read without error.

DO $$
BEGIN
  -- Only add the value if it does not already exist (idempotent)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'assessment_event_type'
      AND e.enumlabel = 'unit_markbook'
  ) THEN
    ALTER TYPE assessment_event_type ADD VALUE 'unit_markbook';
  END IF;
END
$$;
