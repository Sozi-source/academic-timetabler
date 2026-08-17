# v12.14.2 — Cohort Stage Integration Regex Fix

v12.14.1 reached the Batch Registration component but failed because PowerShell
selected the wrong `[regex]::Replace()` overload when both a replacement count
and `RegexOptions.Singleline` were supplied.

This patch:
- uses explicit `Regex` instances instead of the ambiguous static overload;
- resumes safely from the partially applied v12.14.1 state;
- completes the `cohortStageSetups` prop and UI integration;
- verifies the Batch Registration route integration;
- preserves already-applied fixed/sticky sidebar changes;
- keeps the existing v12.14.0 migration unchanged.

After applying:
1. run `npx supabase db push`;
2. run typecheck and lint;
3. start the dev server.
