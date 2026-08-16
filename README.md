# Academic Timetabler cumulative update

This ZIP is a root overlay: it contains only changed source files and the four
new migrations. Extract it into the academic-timetabler project root and allow
Windows to replace matching files.

## What is included

- Simple workload-aware unit allocation.
- Trainer workload roles, normal hours, hard maximum hours, and selected free
  teaching times.
- Fixed day/session constraints for service units.
- HOD-confirmed shared classes for equivalent units such as Communication
  Skills across CND and DND.
- Standard teaching calendar: Morning (08:00-10:00), Mid-morning
  (10:30-12:30), and Afternoon (14:00-16:00).
- Schools, departments, department memberships, and a working-department
  selector.
- Department ownership for programmes, trainers, units, cohorts, offerings,
  allocations, generated sessions, imports, constraints, conflict reviews,
  generation runs, and published timetable versions.
- Institution-wide trainer and room collision protection. Another department's
  booking is treated as protected occupancy without mixing its timetable into
  the working department.

## Existing data

The migration does not delete existing records. It creates:

- School of Health Sciences (SHS)
- Human Nutrition and Dietetics (HND)

Existing programmes, trainers, units, timetable records, and active users are
assigned to HND. Programme codes and names become unique within a department
instead of globally.

If the database does not yet have a system administrator, the oldest active
profile is promoted once so the institution setup cannot become inaccessible.

## Apply in PowerShell

Stop the development server first with Ctrl+C, then run:

~~~powershell
cd "$env:USERPROFILE\Desktop\academic-timetabler"

$zip = Get-ChildItem "$env:USERPROFILE\Downloads" `
  -Filter "academic-timetabler-allocation-update*.zip" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $zip) {
  throw "The update ZIP was not found in Downloads."
}

Expand-Archive `
  -LiteralPath $zip.FullName `
  -DestinationPath . `
  -Force

npm run typecheck
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
npm run dev
~~~

The Docker warning after a successful remote db push only concerns the local
catalog cache. Confirm that the command ends with Finished supabase db push.

## First setup after migration

1. Sign in as a system administrator.
2. Open **Schools and departments**.
3. Create any additional schools and departments.
4. Assign each user to a department and mark their primary department.
5. Use the department selector in the top bar to choose the working department.
6. Register that department's programmes, curriculum units, cohorts, and
   trainers.
7. Configure trainer availability and fixed service-unit sessions.
8. Generate units on offer, assign trainers, check readiness, then generate,
   review, and publish the timetable.

Normal workload is a warning threshold. Maximum workload is a hard,
institution-wide limit, including hours taught for other departments.
