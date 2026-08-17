# v12.6e — Unit Trainer in Compact Marksheet Header

Adds the unit trainer name to every cohort worksheet without increasing the header footprint.

Compact header remains:
- Row 1: School name
- Row 2: CAT MARKSHEET / FINAL EXAM MARKSHEET
- Row 3: Unit + Cohort/Group
- Row 4: Unit Trainer + Academic Period
- Row 5: Marks headings
- Row 6+: Students

Trainer resolution:
- reads the active academic-period teaching allocation for the unit
- supports shared allocations through participant_cohort_ids
- if multiple trainers are allocated to the same cohort/unit, their names are shown together
- if no trainer is assigned, the workbook shows `Unassigned`

No database migration.
