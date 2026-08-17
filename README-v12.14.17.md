# v12.14.17 — ASCII-safe Balanced Unit Table Repair

This replaces v12.14.16, whose PowerShell source itself was corrupted by mojibake.

The script contains only ASCII-safe patch logic and:
- restores Programme, Category and Period before Contact hours;
- balances all visible columns;
- keeps Unit compact with wrapping;
- caps Actions to 52px;
- repairs the Edit-link class;
- replaces the corrupted short-name separator with a plain ASCII hyphen.

No database or scheduling logic changes.
