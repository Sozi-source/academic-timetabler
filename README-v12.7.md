# v12.7 — Trainer Exam Absence Portal

Purpose:
Capture examination absence without any Excel attendance workflow.

Workflow:
1. Trainer signs in to the normal application login.
2. Trainer Portal shows only Unit Markbooks allocated to that trainer.
3. Trainer opens a unit after the exam and compares the expected roster with the physical signed attendance sheet.
4. Everyone is treated as PRESENT by default.
5. Trainer marks only students who did not sign as ABSENT.
6. Confirm Exam Attendance writes all other expected students as present and the selected exceptions as absent.
7. The existing final marks workbook automatically receives AB for confirmed absent students.
8. Once final exam marks are finalized, attendance becomes locked.

Security:
- adds `trainer` to app_role
- trainer account must be linked through trainers.profile_id
- RPC independently verifies the authenticated trainer is allocated to the Unit Markbook's unit and academic period
- no direct broad table write permission is granted
- HOD workflows remain unchanged

No Excel download/upload is used for attendance.
