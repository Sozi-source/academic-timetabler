# v12.14.6 — Adaptive Compact Actions Repair

This replaces the failed exact-match approach from v12.14.5.

Instead of expecting one exact Actions JSX block, the patch:
- finds the final `id: 'actions'` column structurally;
- preserves all existing links, forms, buttons and server actions;
- wraps the existing action controls inside a compact three-dot menu;
- therefore remains compatible with earlier UI changes such as v12.14.4.

Targets:
- Curriculum Units
- Classes & Cohorts
- Programmes, only if safely detectable

No database, Supabase, validation, routing, or scheduling logic is changed.
