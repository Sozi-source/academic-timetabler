# v12.14.10 — Academic Periods Exact UI Repair

Built against the actual current `academic-period-table.tsx` structure.

The current Actions cell is an expression-bodied arrow function:

```tsx
cell: ({ row }) => (
  <div>...</div>
)
```

so v12.14.9's search for a `return (` block could not work.

v12.14.10:
- replaces that exact action block with a 52px three-dot menu;
- preserves the current Edit link and AcademicPeriodLifecycleAction;
- removes the visible Actions header text;
- compacts Academic Year and Status filters on desktop;
- reduces unnecessary column minimum widths;
- changes only the Academic Period table UI.

No database, lifecycle, or timetable-generation logic is modified.
