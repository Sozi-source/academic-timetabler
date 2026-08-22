# Release testing

Academic Planner uses two independent release gates.

## 1. In-app UAT

Open `/testing`.

A release test run snapshots the current department, academic period, automated readiness, suite version and every UAT case definition.

Record each case as **Pass**, **Fail**, or **Blocked**. Fail and Blocked require evidence notes.

Completed and cancelled runs are read-only. A repeat test creates a new run so prior evidence remains auditable.

A run passes only when:
- every case is resolved,
- no Critical or Required case is Fail/Blocked, and
- the automated readiness gate has no blocker at completion.

Export the final run to Excel and retain it with release evidence.

## 2. Local release verification

From the project root:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\scripts\VERIFY_RELEASE_CANDIDATE.ps1
```

The verification script is read-only. It runs:
- `git diff --check`
- TypeScript
- the full Vitest suite
- ESLint
- a production build
- Supabase `db push --dry-run`

Use `-SkipLint` or `-SkipBuild` only while diagnosing an environment-specific failure. Do not treat a skipped check as production sign-off.

## Release sign-off

Production sign-off requires both:
1. a **Passed** in-app UAT run, and
2. a clean release-candidate verification run.

Database deployment remains an explicit separate action.
