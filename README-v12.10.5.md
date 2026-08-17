# v12.10.5 — Canonical Programme Stage Sequence

This patch completes the move away from the legacy
`programme_stages.stage_number` database column.

Application changes
- student-registration queries select/order by `sequence_number`
- stage DTOs expose `sequenceNumber`
- visible mojibake dash fallbacks in registration queries are repaired
- DHNT is removed from the curriculum-import stage policy

Database changes
- preserves stage_number data into sequence_number
- adds canonical `code`, `sequence_number`, `year_number`, `semester_number`
- rewrites active public PostgreSQL functions that reference the standalone
  `stage_number` column
- does NOT rewrite `supplied_stage_number` or `recommended_stage_number`
- drops legacy stage_number
- seeds approved CHN/CND/DHN/DND/DNDT stages
- excludes DHNT
- automatically binds existing units to stages through the existing
  `programme_stage_units` table using units.academic_period_number

Important distinction
`stageNumber()` / `supplied_stage_number` may still exist as internal input
terminology in legacy-compatible code. They are not the removed database
column. The canonical stored field is now `sequence_number`.
