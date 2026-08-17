# v12.14.0 — Fixed Sidebars + Cohort Stage Assignment

This patch addresses both issues together.

## Sidebars
The global dashboard sidebar in the current application is already `fixed` on
desktop. The patch detects nested/module sidebars (including module navigation
with "Back to module hub") and makes them persistent in-view on desktop using
`lg:sticky lg:top-0 lg:h-dvh`. This preserves their existing layout width and
avoids content overlap. Mobile drawer behaviour is unchanged.

## Cohort stages
Adds `cohorts.current_stage_id`.

A cohort stage:
- must belong to the same programme as the cohort;
- can be assigned by HOD/system administrator;
- can be propagated to active/admitted students who currently have no stage;
- does NOT overwrite students who already have an individual stage.

New students automatically inherit the cohort current stage when they are
inserted into a cohort without an explicit student stage.

## Batch Unit Registration
When a cohort is selected, the page now shows a compact Cohort Stage control.
This allows an HOD to set `Y1S1`, `Y1S2`, etc. directly where "No stage" is
currently blocking registration.

Existing individual stage exceptions are preserved.
