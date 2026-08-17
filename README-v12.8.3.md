# v12.8.3 — Units Import Contract Compatibility Fix

Fixes the TypeScript failure:

`Property 'timetableAvailable' does not exist ... Did you mean 'isTimetableAvailable'?`

Cause:
v12.8.2 correctly relaxed Unit Code validation, but accidentally renamed the
existing import contract field from `timetableAvailable` to
`isTimetableAvailable`.

The Units importer, tests, workbook template and database import transaction
already use `timetableAvailable`.

This patch:
- restores the canonical field name `timetableAvailable`
- keeps official unit codes with spaces valid (`CCU 1101`)
- normalizes repeated whitespace without removing official spaces
- restores the real UnitCategory values:
  core, common, elective, practical, clinical, project, other
- converts Yes/No timetable values to boolean, matching the existing import transaction
- retains optional preferred room types used by the timetable system
- does not modify tests to hide the mismatch

No database migration.
