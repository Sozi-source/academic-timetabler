APA TIMETABLER ENTERPRISE — PHASE 6
Professional Timetable Reporting

WHAT THIS RELEASE ADDS
- Master timetable report
- Cohort timetable reports
- Trainer timetable reports
- Room timetable reports
- Trainer workload report
- Summary metrics for sessions, contact hours, cohorts, trainers, rooms and locks
- Print-friendly report views
- UTF-8 CSV exports
- Academic Period and report filtering
- Scheduling navigation link
- Report aggregation tests

DATABASE MIGRATION
None. This module reads the existing scheduled_sessions, working_days,
time_slots, rooms, cohorts, units and trainers data through the existing
Timetable Editor query layer.

APPLY
1. Extract this ZIP into the project root.
2. Allow Windows to merge and replace matching src files.
3. Stop the development server and clear .next.
4. Run the checks below.

CHECKS
npm run typecheck
npm run lint
npx vitest run src/tests/timetable-reports
npm run dev

OPEN
http://localhost:3000/timetable/reports

TEST
- Select the active Academic Period.
- Load the Master timetable.
- Switch through Cohort, Trainer, Room and Trainer workload reports.
- Confirm contact-hour totals match scheduled session durations.
- Print a report.
- Export every report to CSV and open it in Excel.

NOTE
Reports currently reflect editable operational timetable sessions with status
draft, confirmed or locked, matching the authoritative Timetable Editor data.
Published-version snapshot reporting can be added as a later governance report.
