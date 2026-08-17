# v12.8.8 — Unit Import Batch Status Enum Fix

Fixes the PostgreSQL error:
`column "status" is of type public.import_batch_status but expression is of type text`

No Docker or database dump is required. The migration introspects the current
`public.import_valid_unit_rows(uuid)` definition using `pg_get_functiondef()`,
adds explicit enum casts, and recreates the function in place.

It preserves the v12.8.7 duplicate reconciliation logic and the current batch.
