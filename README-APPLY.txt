UPDATED SOURCE + MIGRATION

1. Extract this ZIP into the academic-timetabler project root.
2. Allow folders/files to merge.
3. Run:

   npx supabase db push
   npm run typecheck
   npm run lint

4. Restart the development server.
5. Retry the existing validated Units on Offer batch. If the batch is no longer eligible, upload the workbook again.

The migration fixes:
- unit_category enum casting;
- duplicate Master Unit names within one programme;
- reuse of units created earlier in the same transaction;
- canonical unit-code synchronization in staged rows.
