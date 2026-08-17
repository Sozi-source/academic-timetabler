# v12.8.2 — Official Unit Code Validation Fix

Fixes Units import validation for institutional unit codes such as:

- CCU 1101
- CND 2104
- DHN 3201
- HND/2101
- HND-2101
- HND_2101

Changes:
- spaces are now valid inside Unit Code
- repeated spaces are normalized to one space
- leading/trailing spaces are removed
- codes remain uppercase
- valid characters are letters, numbers, spaces, slashes, underscores and hyphens
- official spaces are preserved; `CCU 1101` is NOT converted to `CCU1101`

No database migration is required.

After applying, upload the same workbook again so the batch is revalidated with the corrected rule.
