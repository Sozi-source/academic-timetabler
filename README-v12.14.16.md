# v12.14.16 — Exact Balanced Unit Table Repair

Built from the user's current `unit-table.tsx` structure.

Repairs:
- restores Programme, Category and Period before Contact hours;
- balances all visible column widths;
- keeps Unit around 190–240 px with natural wrapping;
- fixes Actions maxSize from 210 px to 52 px;
- repairs the Edit-link class damaged by an earlier generic replacement;
- cleans the current mojibake middle-dot sequence;
- preserves Contact hours, Timetable, Status and existing business actions.

No database or scheduling logic changes.
