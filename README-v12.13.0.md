# v12.13.0 — Controlled Student Stage Progression

Adds HOD-controlled academic progression.

- Choose a cohort.
- The system calculates each student's next stage from programme_stages.sequence_number.
- Eligible students are selected automatically.
- HOD can uncheck exceptions.
- Only explicitly selected students progress.
- Final-stage students are never progressed automatically.
- Students without a current stage are flagged.
- Progression does not create unit registrations.
- Every progression is written to student_stage_progression_events.

New route:
`/students/lifecycle-progression`
