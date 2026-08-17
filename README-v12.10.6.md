# v12.10.6 — PostgreSQL Function Scan Fix

The v12.10.5 migration queried `pg_proc` and called `pg_get_functiondef()` on
every PUBLIC routine whose rendered definition might contain `stage_number`.

`pg_proc` also contains aggregates such as `array_agg`. PostgreSQL raises:

`"array_agg" is an aggregate function (SQLSTATE 42809)`

when `pg_get_functiondef()` is called for an aggregate.

This patch adds:

`p.prokind = 'f'`

so the migration scans ordinary functions only.

The failed v12.10.5 push was transactional and was not recorded remotely, so
the existing migration version `20260818002000` can be safely corrected
locally and pushed again.
