# v12.12.3 — Cohort Registration Student Exclusions

Improves cohort-mode batch unit registration.

Changes:
- selecting a cohort automatically checks all eligible students;
- every cohort student now has a checkbox;
- HOD can uncheck individual students who should not be registered;
- only the students still checked are sent to the batch registration RPC;
- students needing attention remain disabled;
- submit button shows the actual number of selected students;
- the batch registration banner is shortened substantially.

No database migration is required. The existing v12.12 RPC already supports
processing explicit student IDs.
