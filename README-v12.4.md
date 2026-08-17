# v12.4 — Unit Markbook Reliability & Workflow Completion

Scope is deliberately limited to the existing Unit Markbook workflow.

Strengthened:
- one deterministic workflow state derived from actual data
- population required before marks upload
- coursework/CAT must be committed before exam attendance
- exam attendance student IDs are validated against the unit population
- final exam uploads require finalized attendance
- completed markbooks reject further uploads/attendance changes
- commit action validates that the staged batch belongs to the current markbook and contains no invalid rows
- existing import batches remain the progressive upload audit trail
- no new module or assessment type is introduced

No database migration is required.
