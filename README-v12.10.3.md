# v12.10.3 — Legacy stage_number compatibility

The current `programme_stages` table has an existing NOT NULL `stage_number`
column.

v12.10.2 correctly added `department_id`, but attempted to insert new stage
rows without `stage_number`. PostgreSQL therefore rejected the row before the
later synchronization step could run.

v12.10.3 repairs the v12.10.2 migration by:

- removing the failed v12.10.2 migration locally;
- setting `stage_number = sequence_number` when updating existing stages;
- including `stage_number` directly in every new programme-stage INSERT;
- keeping all v12.10.2 department-aware logic, unit binding, and DHNT exclusion.

No existing curriculum data is deleted.
