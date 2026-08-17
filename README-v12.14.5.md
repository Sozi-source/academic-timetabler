# v12.14.5 — Compact Overflow Actions

UI-only patch.

Replaces wide table action groups with a compact three-dot overflow menu on
congested timetabler listing pages where the current source matches safely.

Targets:
- Curriculum Units
- Classes & Cohorts
- Programmes (safe-match only)

The menu preserves existing actions such as:
- Edit
- Make/remove timetable availability
- Activate/deactivate or status change

No Supabase, database, validation, routing, scheduling, or business logic changes.
