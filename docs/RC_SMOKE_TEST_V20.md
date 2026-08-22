# Academic Planner V20 — Release Candidate Smoke Test

Run after `scripts/VERIFY_RELEASE_CANDIDATE_V20.ps1` passes.

## HOD / Admin

- Sign in and open **Operations & QA**.
- Confirm readiness counts load for the active department.
- Open **Attendance oversight** and confirm trainer records are department-scoped.
- Reopen one completed attendance record, confirm it becomes editable for the trainer, correct it, then complete it again.
- Open **Teaching Documents → Student releases**.
- Confirm only approved documents appear.
- Publish one approved document.
- Unpublish it and confirm it disappears from the student portal.
- Publish it again for the student test.
- Check **Student access** for issued/active access state.
- Review assessment reports and confirm finalised-but-unpublished counts are sensible.

## Trainer

- Sign in to `/staff`.
- Open **Class Attendance**.
- Create attendance from a published timetable session.
- Confirm the roster is generated from registered students.
- Mark every student **Present** or **Absent** only.
- Save, reload, and confirm draft persistence.
- Complete attendance and confirm it becomes read-only.
- Open an allocated unit assessment and verify existing Excel workflow remains unchanged.
- If online final marks are enabled, verify Assignment, Presentation, RAT, CAT and Exam use the agreed caps.

## Student

- Sign in at `/student/login`.
- Open **Documents**.
- Confirm only HOD-published approved documents appear.
- Download one document.
- Confirm a document unpublished by the HOD disappears.
- Confirm published results show only after release.
- Confirm Unit Registration remains read-only.

## Security boundary

- Trainer cannot access another trainer's allocation attendance.
- Student cannot download another cohort's document by changing the document ID.
- Student cannot download an approved document that has not been explicitly published.
- Trainer cannot reopen completed attendance.
- Only HOD/system admin can publish/unpublish student documents.
- Direct table writes remain blocked by RLS/RPC boundaries.

## Production behaviour

- Test desktop and mobile widths.
- Test refresh on each major route.
- Test sign-out/sign-in between HOD, trainer and student roles.
- Confirm no horizontal overflow.
- Confirm empty, error and loading states are readable.
- Review browser console and server logs for unexpected errors.

Record defects before adding new scope.
