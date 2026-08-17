# v12.8.5 — Unified Official Unit Code Validation

Fixes the remaining Units import issue by aligning BOTH validation layers:

- `src/features/imports/units/validation.ts`
- `src/features/units/validation.ts`

Official unit-code format now allows:
- letters
- numbers
- spaces
- slashes
- underscores
- hyphens

Examples accepted:
- `CCU 1101`
- `CND 2104`
- `DHN 3201`
- `HND/2101`
- `HND-2101`
- `HND_2101`

Whitespace normalization:
- leading/trailing spaces are removed
- repeated spaces collapse to one
- official spacing is preserved, so `CCU 1101` stays `CCU 1101`

Existing safeguards are preserved:
- at least one contact hour is required
- practical units require practical hours
- clinical units require practical/clinical hours
- canonical `timetableAvailable` import contract remains unchanged

No database migration.

Important:
Existing invalid import batches keep their stored validation results.
After applying this patch, upload the workbook again to create a fresh batch.
