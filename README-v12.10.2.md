# v12.10.2 — Department-aware Programme Stages

The existing `programme_stages` table is department-scoped and has a NOT NULL
`department_id`. v12.10.1 inserted stage rows without that field, so PostgreSQL
correctly rejected them.

This patch:
- removes the failed v12.10.1 migration locally;
- preserves the existing stage table;
- derives `department_id` from each programme;
- inserts stages with `department_id`;
- synchronizes legacy stage fields when present;
- seeds CHN, CND, DHN, DND and DNDT only;
- excludes DHNT;
- binds existing units by `academic_period_number`;
- prevents cross-programme unit/stage bindings.

No existing curriculum units are deleted.
