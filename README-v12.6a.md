# v12.6a — Department Unit Registration Completion

This completes the existing unit-registration workflow without replacing student self-registration.

Department/HOD:
- can open any active/admitted student from Unit Registration
- active academic period is fixed automatically
- expected current-cohort units are preselected
- other programme units offered in the same active period are available for genuine exceptions
- changing the expected list requires a short note
- Save & verify writes to the SAME submission/registration tables used by student self-service
- direct HOD registrations are immediately `verified`
- downstream Assessment population sees them through `verified_student_unit_registrations`
- HOD can manage/revise an already verified roster

Student self-registration remains unchanged.
