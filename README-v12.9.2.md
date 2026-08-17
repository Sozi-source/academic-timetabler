# v12.9.2 — Units Registry Programme Code UI Fix

This replaces the failed v12.9.1 apply script.

The v12.9.1 parser error came from a non-ASCII mojibake cleanup line in the PowerShell script.
v12.9.2 removes that unrelated cleanup entirely and uses ASCII-only PowerShell.

Changes:
- Programme column shows only the programme code, e.g. DHN, DND, CHN, CND, DNDT.
- Full programme name remains available as the native title tooltip.
- Programme column width reduced to roughly 80-105px.
- Unit column width increased and given a right gutter.
- No database changes.
- No importer changes.
