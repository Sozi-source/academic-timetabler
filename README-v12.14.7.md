# v12.14.7 — Overflow Menu JSX Repair

v12.14.6 successfully wrapped the congested Actions columns, but PowerShell
interpolated the JavaScript template-literal backticks inside the generated
`aria-label`.

Malformed JSX:
`aria-label={Actions for ${row.original.name}}`

Correct JSX:
`aria-label={`Actions for ${row.original.name}`}`

This repair changes only that malformed JSX in:
- Curriculum Units
- Classes & Cohorts
- Programmes

No actions, forms, links, database logic, or business logic are changed.
