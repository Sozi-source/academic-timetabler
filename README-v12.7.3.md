# v12.7.3 — Canonical Clear ICMHS Logo

Uses the newly supplied clearer ICMHS logo as the canonical branding asset for official generated documents.

Current changes:
- adds `public/branding/icmhs-logo.png`
- CAT analysis DOCX uses the clearer PNG
- Exam analysis DOCX uses the clearer PNG
- cover-image sizing preserves the supplied logo aspect ratio more accurately

Going forward, all new official document generators should reference:
`public/branding/icmhs-logo.png`

The old JPEG may remain in the project for backward compatibility, but current official assessment reports no longer reference it.

No database migration.
