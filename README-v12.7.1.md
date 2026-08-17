# v12.7.1 — AppRole Type Compatibility Fix

Fixes TypeScript errors introduced after adding the `trainer` application role:

`Argument of type 'AppRole' is not assignable to parameter of type '"system_admin" | "hod"'`

The organization guard now accepts the complete AppRole union and still explicitly permits only `system_admin` at runtime.

Security behavior is unchanged:
- trainer is NOT granted organization administration
- hod is NOT granted institution-structure administration
- only system_admin passes requireSystemAdministrator(...)

The v12.7 database migration already applied successfully, so no database push is required for this patch.
