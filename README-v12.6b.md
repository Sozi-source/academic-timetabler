# v12.6b — Programme Stages & Stage-Based Unit Registration

Core model:
Programme → Stage → Units
Student → Current Stage

What changes:
- creates programme stages and stage-to-unit bindings
- adds students.current_stage_id
- adds a compact Stage Setup page under Unit Registration
- HOD selects a student's current stage once
- registration then displays only the units expected for that stage
- previously selected exception units remain visible
- HOD direct registration remains immediately verified
- student self-registration remains on the same authoritative registration tables
- Assessment continues consuming verified_student_unit_registrations

Compatibility:
If a programme has not yet been configured with stages, the registration RPC retains the existing cohort-based expected-unit fallback. This prevents current registrations from breaking while stage setup is being completed.

Important:
Stage represents academic position; cohort remains the intake/history identity. This allows deferred or left-behind students to remain in their original cohort while moving to the correct academic stage.
