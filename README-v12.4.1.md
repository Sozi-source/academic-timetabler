# v12.4.1 — Intelligent Unit Population Recovery

Fixes workbook/attendance downloads returning `Unit population is empty`.

Behavior:
- download first reads the current Unit Markbook population
- when empty, the server automatically rebuilds it using the existing authoritative `refresh_assessment_population` database function
- the workbook is then generated from the rebuilt verified unit-registration population
- if no verified registrations exist, the response explicitly says so instead of returning the generic empty-population error

No database migration.
