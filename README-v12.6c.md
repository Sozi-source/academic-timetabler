# v12.6c — Compact Professional Marksheet & Grading Fix

## Workbook redesign
- Compact header: school name + CAT MARKSHEET / FINAL EXAM MARKSHEET.
- Essential metadata only: Unit, Cohort/Group, Academic Period.
- Marks table begins at row 5 (students at row 6), replacing the old row-18 start.
- Removed visible `AVERAGE (RAT & CAT 1) /15` and `COURSE WORK /30` columns.
- Their calculations remain authoritative under the hood and are recomputed server-side on upload.
- Visible exam columns are now:
  S/No. | Admn No. | Student's Name | Assignments /5 | Presentations / Practicals /10 | RAT /15 | CAT 1 /15 | End Term Exam /70 | Total /100 | Grade | Comment
- Total formula directly applies hidden coursework logic:
  Assignment + Presentation/Practical + Average(RAT,CAT1) + Exam.
- Existing AB attendance behavior remains intact.
- Freeze pane/filter/protection ranges updated to the compact layout.
- Template version raised to 1.1 so old-layout workbooks cannot be silently parsed with wrong column positions.

## Grading
- 75–100: A — DISTINCTION
- 65–74: B — CREDIT
- 50–64: C — SATISFACTORY
- 40–49: D — PASS
- Below 40: E — FAIL

The server-side `gradeFor()` function uses the same thresholds.

## v12.6b lint correction included
Escapes the two apostrophes that caused `react/no-unescaped-entities` errors in the student stage registration page.

No database migration is included.
