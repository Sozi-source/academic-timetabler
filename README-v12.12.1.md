# v12.12.1 — Batch Registration JSX Repair

v12.12.0 inserted the Batch registration button immediately after the first
`return (` in the Unit Registration page. That page has a conditional return
for the "No active academic period" state, so the injected button became a
second JSX root sibling and TypeScript reported:

`JSX expressions must have one parent element`

This repair:
- removes only the misplaced injected button;
- removes the `next/link` import if it became unused;
- keeps the batch registration route and database migration unchanged;
- creates a reusable `BatchRegistrationLink` component for safe placement
  after the actual page structure is inspected.

The batch page itself remains available at:
`/students/unit-registration/batch`
