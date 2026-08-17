# v12.14.3 — Batch Registration Eligibility Diagnostics

Replaces the generic `Needs attention` status with exact registration blockers.

Student states:
- `X units ready`
- `No stage`
- `No stage units`
- `No matching units on offer`

The patch does not change registration eligibility rules or database structure.
It only makes the existing decision process visible so blocked cohorts can be
diagnosed immediately.

Files updated:
- `src/features/student-unit-registration/batch-types.ts`
- `src/features/student-unit-registration/batch-queries.ts`
- `src/features/student-unit-registration/batch-unit-registration.tsx`

No Supabase migration is required.
