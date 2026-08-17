# v12.14.8 — Full-width CRUD Workspace Standardization

Introduces a shared responsive `CrudModal` and converts exposed creation forms
on safe timetable CRUD pages into modal workflows.

Targets when their current source contains the expected Create form:
- Academic Years
- Academic Periods
- Programmes
- Classes & Cohorts
- Curriculum Units
- Trainers
- Rooms

Teaching Sessions is converted only if it has one simple CreateTimeSlotForm.
Compound working-day/time-slot calendar workflows are deliberately left alone.

Result:
- records get the full available page width;
- creation starts from a compact primary button;
- forms open in a centered desktop modal;
- on mobile, the modal becomes a near-full-screen bottom sheet;
- Escape, backdrop click, and the X button close the modal.

The patch deliberately does not alter imports, generators, timetable editor,
reports, allocation workspaces, or database/business logic.
