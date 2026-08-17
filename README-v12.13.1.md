# v12.13.1 — Department Helper Compatibility Fix

The v12.13.0 progression migration referenced:

`public.current_department_id()`

That helper does not exist in the current Academic Timetabler database.

The existing application already uses:

- `public.current_user_primary_department_id()`
- `public.current_user_can_manage_department(uuid)`

This patch updates the failed local migration to use those established helpers.

It changes:
- progression audit RLS department resolution;
- progression RPC actor department resolution;
- adds an explicit department-management check to the audit-table SELECT policy.

The failed v12.13.0 migration was not applied remotely, so its existing local
migration file is corrected in place and can be pushed again.
