# v12.8.6 — Unit Room-Type Validation Compile Fix

Fixes:
`Module '@/features/rooms/types' has no exported member 'roomTypeValues'`

Cause:
v12.8.5 referenced a helper constant that does not exist in the current project.

Fix:
- removes the invalid `roomTypeValues` import
- uses the existing supported room-type values directly in the Unit validator:
  lecture_room, laboratory, skills_room, computer_lab, kitchen,
  conference_room, other
- keeps the official Unit Code rule with spaces
- keeps all restored contact-hour safeguards

No database migration.
Only `src/features/units/validation.ts` is changed.
