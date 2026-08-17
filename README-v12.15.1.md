# v12.15.1 — Stage Unit Binding Backfill

This corrects v12.15.0.

The project already has the stage-unit binding foundation:
- `programme_stage_units.stage_id`
- `programme_stage_units.unit_id`
- `save_programme_stage_units(...)`
- registration queries that read those bindings

The missing issue is that the binding rows were not populated for the canonical
programme stages.

v12.15.1 therefore **does not create another binding table**.

It safely backfills missing bindings using:

`units.programme_id = programme_stages.programme_id`

and

`units.academic_period_number = programme_stages.sequence_number`

It also creates a small `programme_stage_binding_health` audit view and a unique
index preventing duplicate stage/unit rows.

Manual stage-unit bindings are preserved; the migration inserts missing rows only.
