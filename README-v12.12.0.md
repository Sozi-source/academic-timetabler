# v12.12.0 — Batch Student Unit Registration

Supports both workflows requested:

1. Entire cohort
   - choose a cohort;
   - every eligible student is processed;
   - each learner still resolves Programme -> Current Stage -> Bound Units;
   - only units on offer for the active academic period are registered.

2. Selected students
   - tick specific eligible students;
   - a "Select all eligible" shortcut is available;
   - students without a current stage or eligible units are disabled and marked
     "Needs attention".

Safety / behaviour:
- existing registrations are skipped, not duplicated;
- registration is idempotent through NOT EXISTS + ON CONFLICT DO NOTHING;
- students are processed individually according to their own programme/stage;
- cohort mode does not assume all students have the same stage;
- only active/admitted students are considered;
- only included, non-cancelled Units on Offer are eligible;
- the RPC returns counts for selected, eligible, attention, created and skipped rows;
- supports current registration table variants with optional department_id,
  cohort_id and stage_id columns.

New route:
`/students/unit-registration/batch`

The patch also adds a Batch registration button to the existing Unit Registration
page.
