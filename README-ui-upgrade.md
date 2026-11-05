# UI upgrade, round 2 (copy over matching paths under src/)

Round 1 files are included again, with changes: trainers/access/page.tsx now relies on the shell breadcrumb, and trainer-access-table.tsx gained a `variant` prop.

## New / changed
- components/ui/data-table.tsx, page-header.tsx (round 1)
- components/ui/fast-tab.tsx, record-shell.tsx (round 1, not yet used on a page)
- components/layout/auto-breadcrumb.tsx (NEW): breadcrumb built from the URL
- components/layout/platform-shell.tsx, timetable-shell.tsx, student-shell.tsx, assessment-shell.tsx: render <AutoBreadcrumb /> above page content
- features/trainer-access/trainer-access-table.tsx: `variant="pin" | "password"`
- features/students/student-count-table.tsx (NEW)
- app/(dashboard)/trainers/page.tsx: access table -> TrainerAccessTable; gray-* -> design tokens
- app/(dashboard)/trainers/[id]/page.tsx, operations/page.tsx: gray-* -> design tokens
- app/(dashboard)/students/reports/page.tsx: both tables -> DataTable
- app/(dashboard)/trainers/access/page.tsx

## Deliberately NOT converted
teaching-allocations, unit-equivalence (server-action forms inside cells), marks entry, trainer availability, analytics, timetable grids and print pages. These are grids, matrices or forms, not record lists.

Not compiled or run. Run `npx tsc --noEmit`, then `npm run dev`.

## Round 3
- app/(dashboard)/students/registry/[studentId]/page.tsx: student record page now uses RecordShell (title, status badge, tabs to Class assignments / Results / Student view, action ribbon) and FastTab sections (Cohort and dates, Update student status, Timeline). The tabs only appear on the Overview page; the three sub-pages keep their own headers.
- components/ui/record-shell.tsx: `breadcrumbs` now optional.
- Left alone: student-registry-table.tsx (573 lines, custom filters and server export), curriculum page (upload forms in cells), results transcript tables.
