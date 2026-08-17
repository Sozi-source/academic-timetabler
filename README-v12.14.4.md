# v12.14.4 — Timetabler Table Layout Repair

UI-only patch for Curriculum Units, Classes & Cohorts, and Programmes.

Fixes:
- shared DataTable keeps natural column widths instead of crushing columns;
- wide tables scroll horizontally;
- programme short code is used in Units and Cohorts tables;
- unit/programme names no longer wrap letter-by-letter;
- Cohort dates/progress/enrolment get compact readable widths;
- action controls use a compact vertical layout;
- known mojibake middle-dot artifacts in the Unit table are cleaned.

No database, Supabase, routing, validation, timetable generation, or scheduling logic is changed.
