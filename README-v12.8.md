# v12.8 — Authoritative Curriculum Excel Import

Adds a dedicated Curriculum importer. It does not reuse the operational Units importer.

Workbook rules:
- Excel .xlsx only; CSV is not accepted.
- Fixed protected headers:
  Programme Code | Stage | Unit Code | Unit Name
- Standard Instructions and hidden _meta worksheets are generated automatically.
- The upload is rejected if headings, worksheet names, template version or metadata are altered.

Validation:
- Programme Code must exist in the active department.
- Supported stage ranges:
  CHN/CND Y1S1–Y2S3
  DHN/DND Y1S1–Y3S3
  DHNT/DNDT Y1S1–Y2S1
- Duplicate Programme Code + Unit Code rows are blocked.
- Existing units are matched by programme + unit code.
- If a matched legacy unit has a different official name, the review shows `Normalize name`; committing makes the curriculum workbook name authoritative.
- A curriculum name already attached to another code is blocked.
- Missing units are created only after the clean review is confirmed.

Commit:
- all rows must be clean; no partial curriculum commit
- programme stages are created/normalized from YxSy values
- matched unit operational settings (hours/category/timetable availability) are preserved
- new units receive safe baseline operational defaults and a review note
- programme_stage_units becomes the authoritative stage binding
- historical student registrations are untouched
