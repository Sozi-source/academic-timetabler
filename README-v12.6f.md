# v12.6f — Clean Single-Line Marksheet Metadata Header

Redesigns only the visible workbook header.

New compact structure:
- Row 1: IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES
- Row 2: CAT MARKSHEET / FINAL EXAM MARKSHEET
- Row 3: Unit code · Unit name
- Row 4: Cohort | Academic Period | Trainer
- Row 5: Marks headings
- Row 6+: Student rows

Improvements:
- removes the cramped label/value mini-table
- removes `Cohort / Group` and uses the shorter `Cohort`
- prevents metadata labels from wrapping into multiple lines
- uses rich-text labels and values in one compact horizontal band
- keeps metadata borderless
- does not add any extra vertical space
- preserves student-row-only borders, cohort mean score/grade, grading, formulas and workbook parsing

No database migration.
