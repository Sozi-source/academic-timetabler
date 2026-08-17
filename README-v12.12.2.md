# v12.12.2 — Batch Registration UI Completion

Completes the batch unit-registration feature after the v12.12.1 JSX repair.

Changes:
- safely places the Batch Registration action inside the final Unit Registration
  page JSX root rather than inside a conditional return;
- keeps the existing `/students/unit-registration/batch` route;
- shows a post-registration summary:
  - students selected;
  - eligible students;
  - registrations created;
  - existing registrations skipped;
  - students needing attention;
- shows server/RPC errors in-page;
- adds Back to Unit Registration and Programme Stages navigation;
- makes the batch UI more compact and mobile-friendly;
- adds Clear and Select all eligible controls;
- keeps Needs attention indicators for ineligible students;
- does not change any database schema or registration business rules.

No Supabase migration is included because v12.12.0 already installed the batch
registration RPC successfully.
