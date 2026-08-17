# v12.9.0 — Compact Programme Code in Units Registry

Updates only the Units registry UI.

Changes:
- Programme column displays the programme code only, e.g. CHN, CND, DHN, DND, DNDT.
- Full programme name remains available as a hover title.
- Programme column becomes compact (about 82–110 px).
- Unit column is protected with its own minimum width and right gutter.
- Long unit names wrap inside the Unit column instead of visually colliding with Programme.
- Programme searching/sorting uses the visible short code.

No database migration.
No unit/import business logic changes.
