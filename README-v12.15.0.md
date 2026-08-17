# v12.15.0 — Programme Stage Unit Binding

Adds the missing curriculum relationship:

Programme -> Programme Stage -> Units

Included:
- `programme_stage_units` database table
- stage/unit binding query
- stage/unit save action
- searchable checkbox binding UI
- route: `/timetable/programme-stages/[stageId]/units`
- best-effort “Manage units” link injection on the Programme Stages UI
- visible bound-unit count on the binding page

Important:
The patch deliberately does not guess the current Batch Unit Registration query structure.
If `cohort-stage-queries.ts` does not already reference `programme_stage_units`, the apply
script prints a warning. In that case, the next patch should update the batch eligibility
query against the exact current file.

No automatic stage progression logic is changed.
