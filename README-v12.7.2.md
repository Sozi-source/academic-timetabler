# v12.7.2 — Trainer Portal Capability Access

Strengthens the trainer portal access model without adding a new feature.

Why:
HODs and system administrators may also teach units. A singular `trainer`
application role should not force an HOD to lose HOD permissions just to
record exam absentees.

Change:
- `requireTrainerAccess()` now allows trainer, hod and system_admin roles.
- Actual trainer capability remains enforced by the trainer workspace:
  the authenticated profile must still be linked to an ACTIVE trainers row.
- The exam-attendance RPC independently verifies that the linked trainer is
  allocated to the Unit Markbook unit/academic period.
- HOD/system_admin permissions are unchanged.
- Standalone trainers continue using the `trainer` role.

No database migration.
