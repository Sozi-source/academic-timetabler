# v12.8.4 — Units Contact-Hours Validation Restoration

Fixes the two remaining Unit import validation test failures.

Restored business rules:
- a unit cannot have both Theory Hours = 0 and Practical Hours = 0
- a `practical` unit must have Practical Hours > 0
- a `clinical` unit must have Practical Hours > 0

Retained fixes:
- official unit codes with spaces remain valid, e.g. `CCU 1101`
- repeated unit-code whitespace is normalized but official spaces are preserved
- canonical `timetableAvailable` import field is retained
- Yes/No timetable values normalize to boolean
- the existing UnitCategory values remain intact

No tests are modified.
No database migration is required.
