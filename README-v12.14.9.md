# v12.14.9 — Academic Periods Workspace Repair

Fixes the Academic Period listing shown after the full-width CRUD conversion.

Changes:
- converts the very wide row Actions controls into a compact three-dot menu;
- preserves the existing Edit/status/Set actions inside that menu;
- gives Academic Period names a stable readable width;
- improves the desktop filter toolbar so search/year/status can share one row where the current layout pattern allows it;
- repairs the malformed overflow aria-label pattern if it exists;
- avoids touching the shared DataTable globally.

No database, academic-period lifecycle rules, scheduling logic, or server actions are changed.
