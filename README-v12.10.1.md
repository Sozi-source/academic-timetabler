# v12.10.1 — Adaptive Programme Stages Fix

Why v12.10.0 failed:
`programme_stages` already exists in the database from the earlier stage-based
registration work, but it does not currently have the new canonical `code`
column. `CREATE TABLE IF NOT EXISTS` therefore skipped creation, and the next
index statement referenced a column that was not present.

v12.10.1:
- preserves the existing `programme_stages` table
- adds missing canonical fields with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- backfills from legacy `stage_code`, `stage_name`, `stage_number`, or
  `academic_period_number` columns when they exist
- seeds CHN/CND/DHN/DND/DNDT stages
- excludes DHNT
- binds existing Units to stages through `academic_period_number`
- keeps `academic_period_number` for compatibility
- adds cross-programme binding protection

The failed v12.10.0 migration is removed locally before pushing.
