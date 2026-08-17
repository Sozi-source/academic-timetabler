# v12.10.0 — Programme Stages + Automatic Unit Binding

This is the stage foundation for intelligent unit registration.

Stage structures:
- CHN: Y1S1 -> Y2S3 (6)
- CND: Y1S1 -> Y2S3 (6)
- DHN: Y1S1 -> Y3S3 (9)
- DND: Y1S1 -> Y3S3 (9)
- DNDT: Y1S1 -> Y2S1 (4)
- DHNT: excluded

What the migration does:
- creates/normalizes `programme_stages`
- seeds programme stages
- adds `units.programme_stage_id`
- automatically binds existing units from `academic_period_number`
- prevents cross-programme stage assignment
- adds `students.current_programme_stage_id` when the students table exists
- backfills student stage when `current_academic_period_number` exists
- adds secure `set_student_programme_stage(...)`
- adds `get_student_stage_units(...)` so the registration UI can show only the student's stage units

No curriculum rows are deleted.
`academic_period_number` remains for backward compatibility.

Next UI step:
Wire the existing student unit-registration page to `get_student_stage_units()`
and add the stage selector for HOD/admin. That should be patched against the
actual current registration page source after this database foundation applies.
