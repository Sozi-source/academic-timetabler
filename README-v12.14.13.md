# v12.14.13 — Curriculum Units Reference-Design Repair

Targeted UI-only patch based on the approved Curriculum Units reference design.

Final overview columns:
- Unit
- Programme
- Category
- Period
- Timetable
- Status
- compact overflow menu

Removed from this listing only:
- Room preference
- Contact hours

The data and scheduling fields remain in the application; they are simply not
shown in this high-density overview.

Toolbar:
- Search
- Period
- Category
- Status
- Availability
- Clear filters when active

The Programme dropdown is removed from the toolbar to prevent congestion.
Programme remains visible in the table and remains part of unit search.

No shared DataTable, database, validation, or scheduling logic is changed.
