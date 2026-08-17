# v12.6g — Standard Academic Stage Structures

This strengthens the existing stage-based registration workflow.

Standard ranges:
- CHN / CND: Y1S1 → Y2S3
- DHN / DND: Y1S1 → Y3S3
- DHNT / DNDT: Y1S1 → Y2S1

Academic Stages page:
- shows one selected programme at a time to keep the page uncluttered
- provides `Generate standard stages` for the supported programmes
- automatically creates/normalizes Y1S1, Y1S2, etc.
- does NOT assign units automatically
- lets the HOD bind units to each stage after generation
- student registration continues to show only stages from that student's programme
- cohort remains the intake identity; current_stage_id remains the academic position

Safety:
- existing unit bindings on retained stages are preserved
- extra historical stages are not deleted
- an extra stage is only deactivated if no student currently references it
- no historical student unit registrations are changed
