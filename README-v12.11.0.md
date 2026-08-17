# v12.11.0 — Programme Stage Management + Stage-Filtered Registration

This is the first user-facing layer on top of the canonical programme-stage model.

It adds:
- a professional Programme Stages management page;
- programme short codes (CHN, CND, DHN, DND, DNDT);
- Y1S1/Y1S2/etc. stage codes;
- sequence ordering;
- unit counts per stage;
- unbound-unit warnings;
- checkbox-based unit binding review;
- save-per-stage workflow using the existing `saveProgrammeStageUnits` action;
- stage `code` in registration/query DTOs;
- verification that existing student registration continues filtering units through
  `programme_stage_units` and the student's `current_stage_id`.

No new database migration is included. v12.10.5/v12.10.6 must finish successfully
first because they provide the canonical `sequence_number` stage model and automatic
curriculum binding.
