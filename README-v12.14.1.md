# v12.14.1 — Batch Page Integration Repair

v12.14.0 successfully updated the Student and Assessment module sidebars, then
stopped while trying to integrate the cohort-stage control into the Batch Unit
Registration route.

Cause:
- the original PowerShell patch searched for `Environment.NewLine`;
- the TSX route uses LF line endings;
- therefore no newline/import boundary was found.

v12.14.1:
- preserves the already-applied sidebar changes;
- is idempotent for sidebar persistence;
- integrates `getCohortStageSetups()` without depending on CRLF vs LF;
- passes `cohortStageSetups` to `BatchUnitRegistration`;
- inserts `CohortStageAssignment` below the cohort selector;
- keeps the original v12.14.0 migration and feature files.

After applying, run `npx supabase db push`, then typecheck/lint.
