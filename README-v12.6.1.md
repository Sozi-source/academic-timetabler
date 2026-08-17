# v12.6.1 — Secure Department Unit Registration RPC Fix

Fixes:
`permission denied for table student_unit_registrations`

Cause:
The HOD/direct registration RPC used SECURITY INVOKER, but authenticated users are intentionally not granted broad direct write access to student_unit_registrations.

Fix:
- changes only department_register_student_units(...) to SECURITY DEFINER
- retains current_user_can_manage_department(...) authorization inside the function
- retains active-period, student-eligibility, programme/unit and exception-note validation
- execute remains restricted to authenticated
- does not grant direct INSERT/UPDATE/DELETE permissions on registration tables

Migration timestamp is deliberately later than the prior patches to avoid another --include-all ordering issue.
