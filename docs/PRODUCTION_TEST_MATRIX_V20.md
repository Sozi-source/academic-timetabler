# Academic Planner Production Test Matrix

This checklist is for the first structured end-to-end test cycle after V20.

## 1. Authentication and role boundaries

- HOD signs in and reaches the department workspace.
- Trainer signs in and sees only allocated units.
- Student signs in only with a valid admission number and PIN.
- Disabled student access fails immediately.
- A trainer cannot open another trainer's allocation by changing the URL.
- A student cannot access staff or HOD routes.

## 2. Student lifecycle and registration

- Import a test student using the standard XLSX workflow.
- Confirm programme, cohort and stage.
- Generate current academic-period unit registration.
- Confirm all expected units are registered.
- Undo registration and confirm dependent rows are removed transactionally.
- Recreate registration.
- Issue student portal access.
- Reset the PIN and confirm the previous session is revoked.

## 3. Timetable

- Create or confirm teaching allocations.
- Generate a timetable.
- Resolve conflicts before publication.
- Publish the timetable.
- Confirm the same published timetable appears for HOD, trainer and student.
- Confirm shared trainers cannot be double-booked across departments.

## 4. Assessment and marks

- Create/prepare one test assessment.
- Generate and lock the registered assessment population.
- Mark one student absent before workbook download.
- Download the existing institutional Excel mark sheet and confirm it still contains:
  - Assignment /5
  - Presentation / Practical /10
  - RAT /15
  - CAT 1 /15
  - End Term Exam /70
- Test Excel import validation with one deliberate invalid mark.
- Correct the workbook and commit.
- Test the online final marks workflow on a separate assessment.
- Confirm online marks use the same final calculation and do not overwrite committed Excel results.
- Finalise, publish and confirm only published results appear in the student portal.

## 5. Teaching Documents

- Upload one real college template for each of the four controlled document types.
- Activate each template.
- Trainer creates a working copy.
- Trainer uploads a revision.
- Trainer submits.
- HOD returns one document with a correction note.
- Trainer corrects and resubmits.
- HOD approves.
- Confirm the approved revision is immutable.

## 6. Class Attendance

- Confirm only Present / Absent are available.
- Open attendance from a published trainer timetable session.
- Confirm the student roster comes from registered students.
- Leave one student unmarked and confirm completion is blocked.
- Mark every student and complete.
- Confirm the session becomes read-only.
- HOD reopens the completed session.
- Trainer corrects attendance and completes again.
- Confirm the audit feed contains open, status-change, complete and reopen activity.

## 7. Operations & QA

- Open `/operations`.
- Confirm the active academic period is correct.
- Confirm student, allocation, assessment, document and attendance counts match source modules.
- Resolve a readiness warning and confirm it disappears after refresh.
- Open `/operations/audit` and verify actors and timestamps.
- Export `academic-planner-operations-report.xlsx` and verify all worksheets.

## 8. Responsive and production checks

- Test HOD, trainer and student portals at phone, tablet and desktop widths.
- Confirm there is no horizontal page overflow outside intentional data tables.
- Run:
  - `node scripts/verify-critical-workflows.mjs`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
- Test production Supabase RLS using at least one HOD, one trainer and one student account.
