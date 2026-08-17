# v12.14.12 — Remove Room Preference Column

UI-only patch.

Removes the **Room preference** column from the Curriculum Units listing:

`src/features/units/unit-table.tsx`

The underlying room-preference field, database data, validation, allocation logic,
and scheduling behaviour are preserved. Only the table column is removed to
recover horizontal space.
