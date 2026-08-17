# v12.8.7 — Units Import Duplicate Reconciliation

Problem fixed
-------------
The Units review could show a row as `Ready` even though PostgreSQL would later
reject it with:

`duplicate key value violates unique constraint "units_programme_name_unique_idx"`

The database has TWO uniqueness rules for units:
1. programme + normalized Unit Code
2. programme + normalized Unit Name

The importer previously did not fully mirror both rules.

What this patch does
--------------------
- Detects existing database duplicates by programme + Unit Code.
- Detects existing database duplicates by programme + Unit Name.
- Detects same Unit Name repeated inside the workbook under different codes.
- Moves those rows to `Duplicate` BEFORE insertion.
- Records a human-readable row-level explanation and existing unit ID.
- Refreshes Ready / Invalid / Duplicate batch counts.
- Adds a safe confirmation wrapper that rechecks the latest database state.
- If a conflict appears between validation and confirmation, nothing is inserted;
  the batch is updated and the user is asked to review again.
- Keeps the database unique constraints intact.

Existing failed batch
---------------------
You do NOT need to upload the workbook again merely to recover the current batch.
After this patch is applied, click `Import` once on the existing batch. The safe
preflight will reclassify any hidden conflicts and return you to the updated review.
Then confirm the remaining Ready rows.

Application
-----------
1. Extract this ZIP into the project root.
2. Run: powershell -ExecutionPolicy Bypass -File .\APPLY-v12.8.7.ps1
3. Run: npx supabase db push
4. Run typecheck, lint, tests, build.
