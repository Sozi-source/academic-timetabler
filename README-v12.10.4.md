# v12.10.4 — Remove stage_number

Standardizes programme stages on:

- department_id
- programme_id
- code (`Y1S1`, `Y1S2`, ...)
- name
- sequence_number
- year_number
- semester_number
- is_active

The legacy `stage_number` column is removed.

Safety:
1. Existing stage_number values are copied into sequence_number first.
2. The apply script scans `src/` for `stage_number` or `stageNumber`.
3. If application code still depends on the legacy field, the script stops
   before any database migration is pushed.
4. Failed v12.10.1/v12.10.2/v12.10.3 local migrations are removed.
5. Units are bound to stages through their existing academic_period_number.

DHNT remains excluded.
