# CHANGES.md — Architectural Delta Registry & Project Changelog

This document tracks all architectural modifications, schema updates, bugfixes, breaking changes, and pending manual follow-up tasks across the codebase. 

> **Instruction for AI Agents & Developers**: Any time you update, refactor, or migrate code in this project, append a summary of your changes under [Recent Architectural Updates](#recent-architectural-updates) following the standard format below.

> [!CAUTION]
> **NON-NEGOTIABLE CORE POLICY — ZERO REGRESSION & WORKING CODE PROTECTION**:
> **Never alter, break, or degrade working code when fixing a different issue.**
> Targeted bugfixes and feature updates must strictly limit modifications to the designated scope. Before modifying shared components, data contracts, or layout structures, agents and developers must audit all consumer sites, verify that existing features remain untouched, and prevent unintended regressions or collateral damage.

---

## Active Pending Actions & Technical Debt

1. **Teaching Documents — Legacy Template ID Migration**:
   - Legacy DB rows stored curriculum templates under `tpl-tvet-<code>` (without document type suffix). A migration is needed to reclassify each row as either `scheme_of_work` or `course_outline` and re-save under `tpl-tvet-<code>-<type>`.
2. **Curriculum Upload UI Update (`curriculum-zip-upload-dialog.tsx`)**:
   - Update `curriculum-zip-upload-dialog.tsx` to display `unresolvedFiles` from the ingestion preview response, allowing HODs to select document types manually prior to commit.

### 2026-09-18: Enterprise Unit Offering Lifecycle Synchronization & Ghost Clash Elimination

- **Context & Problem**:
  - The HOD encountered an error when attempting to drop **Agricultural Production** from cohort `CHN MAY 25`:
    `The unit does not belong to the cohort current programme period`
  - The HOD previously dropped **Research** from cohort `DNDT SEP 26`, but the timetable continued to read it and report clashes against other units.
  - The HOD required that whenever a unit is dropped from or added to a cohort, subsequent timetable generations and manual scheduling reflect the change atomically and reliably under enterprise standards.
  - **Root Causes**:
    1. In `validate_teaching_allocation()`, the PostgreSQL trigger checked `selected_unit.academic_period_number` against the cohort's current semester even during deactivation (`status = 'suspended'`, `is_timetable_enabled = false`). Because the offering was set to `is_timetable_enabled = false` immediately before the allocation update, the exception query failed and blocked dropping the unit.
    2. In `set_unit_offering_approval()`, dropping an offering only searched allocations linked via `source_unit_offering_id` (ignoring legacy allocations linked by `(academic_period_id, cohort_id, unit_id)`). For shared classes, it did not delete the cohort from `teaching_offering_participants`, `teaching_allocations.participant_cohort_ids`, or `scheduled_sessions.participant_cohort_ids`. Because the cohort remained in `participant_cohort_ids` of the session, the clash detector continued to see the cohort as occupied.
    3. Old locked sessions for dropped units were preserved by `save_generated_timetable_draft()`, preventing generator runs from cleaning them up.
    4. In `add_special_unit_offering()`, newly added cohort units were not given `approval_status = 'approved'`, leaving them in review-required state and without an unassigned draft teaching allocation.
- **Key Changes**:
  - `supabase/migrations/20260918183000_enterprise_unit_offering_lifecycle_sync.sql`:
    - Updated `public.validate_teaching_allocation()`: Bypasses all checks and immediately returns when an allocation is disabled or set to `suspended`, `completed`, or `archived`. For active allocations, permits cross-stage units if an approved offering exists for `(academic_period_id, cohort_id, unit_id)` or if audited.
    - Updated `public.set_unit_offering_approval()`:
      - **When dropping (`p_approve = false`)**: Removes the dropped cohort from `teaching_offering_participants`. In shared allocations, reassigns primary cohort if necessary, removes dropped cohort from `participant_cohort_ids`, and recalculates `combined_cohort_size`. In solo allocations, suspends the allocation. In scheduled sessions, removes the dropped cohort from shared sessions and unlocks/cancels solo sessions (`status = 'cancelled'`, `is_locked = false`).
      - **When approving (`p_approve = true`)**: Re-enables allocations and automatically inserts an unassigned draft allocation if none exists.
    - Updated `public.add_special_unit_offering()`: Marks offerings as approved by the active HOD and ensures an unassigned draft teaching allocation is created or enabled.
    - Updated `public.save_generated_timetable_draft()`: Automatically purges any orphaned, suspended, or cancelled sessions belonging to the department before persisting fresh timetable sessions.
    - Immediate Data Cleanup: Removed `DNDT-SEP-2026` from Research participants, allocations, and sessions; reconciled cancelled/solo sessions.
  - `src/features/unit-offerings/approval-actions.ts`:
    - Added `revalidatePath` calls for `/timetable/editor`, `/timetable/conflicts`, `/timetable/published`, and `/timetable/reports` in `approveUnitOfferingsAction`, `withdrawUnitOfferingAction`, and `addCohortUnitOfferingAction`.
  - `src/features/timetable-generator/data-adapter.ts`:
    - In `createAutomaticPlannerInput`, excluded any existing sessions with `status === 'cancelled'` from being preserved.
- **Verification**:
  - `npm test`: 117/117 test files passed, 598/598 unit tests passed.
  - `npm run check`: TypeScript typecheck, ESLint, and Next.js 16 production build passed with 0 errors and 0 warnings.
- **Manual Follow-up**:
  - Run migration `supabase/migrations/20260918183000_enterprise_unit_offering_lifecycle_sync.sql` in the Supabase SQL Editor.

### 2026-09-18: Food Safety & Hygiene Cohort Correction & Selective/Standalone Timetable Scheduling Controls

- **Context & Problem**:
  - The HOD attempted to schedule **First Aid** (`DCU 1104` or equivalent) on **Friday 10:30** for cohort `DHN-JAN-MAR-2025`.
  - The editor blocked placement with:
    `Shared Partner Conflict: Cohort DND-SEP-2025: Partner cohort DND-SEP-2025 (sharing this unit) already has CND 1203 Food Safety and Hygiene with Fiona Kwamboka in THK 2-03 at this time.`
  - Domain truth established by the HOD: **Food Safety (`CND 1203`) belongs ONLY to `CND` and `DND-MAY-2026`**; it does not belong to `DND-SEP-2025` and must never affect First Aid groups.
  - Root cause: In the database, `DND-SEP-2025` was erroneously linked as a participant cohort to `CND 1203 Food Safety and Hygiene`. Because `CND 1203` was already scheduled at Friday 10:30, `DND-SEP-2025` was marked as occupied. First Aid had `DND-SEP-2025` in its shared offering, so the conflict detector blocked placing First Aid.
  - Furthermore, the timetable editor lacked manual controls to decouple partner cohorts or schedule a standalone session for `DHN-JAN-MAR-2025` alone.
- **Key Changes**:
  - `supabase/migrations/20260918173000_correct_food_safety_cohort_participants.sql`:
    - Cleaned `DND-SEP-2025` out of `teaching_offering_participants`, `teaching_allocations`, and `scheduled_sessions` for `CND 1203 Food Safety and Hygiene`.
    - Recalculated `combined_cohort_size` and synchronized participant contexts.
    - Updated `public.schedule_allocation_session_safely` to accept optional `target_participant_cohort_ids uuid[] default null`.
    - Updated `public.validate_scheduled_session_conflicts()` to evaluate clashes against explicit `new.participant_cohort_ids`.
  - `src/features/timetable-editor/schedule-allocation-dialog.tsx`:
    - Added interactive **Participating Cohorts selector** with individual cohort checkboxes for shared classes.
    - Added one-click toggle: `"Only {allocation.cohortCode}"` / `"Include All Shared"`.
    - Added quick-action button in the conflict warning: `"Exclude partner cohorts & place for {allocation.cohortCode} only"` to instantly clear partner clashes.
    - Conflict calculations evaluate real-time clashes strictly against the active selected cohorts.
    - Complies with React 19 prop adjustment patterns (zero cascading renders).
  - `src/features/timetable-editor/types.ts` & `src/features/timetable-editor/queries.ts`:
    - Added `participantCohorts: Array<{ id: string; code: string }>` to `EditorData['missingAllocations']` mapping cohort IDs to codes.
  - `src/features/timetable-editor/validation.ts`:
    - Extended `scheduleAllocationSchema` to parse optional JSON string array `participantCohortIds`.
  - `src/features/timetable-editor/actions.ts`:
    - Forwarded `target_participant_cohort_ids` to `supabase.rpc('schedule_allocation_session_safely')`.
    - Restricted `diagnoseScheduleClash` to evaluate conflicts exclusively against the chosen participant cohorts.
- **Verification**:
  - `npm test`: 117/117 test files passed, 598/598 unit tests passed.
  - `npm run check`: Typecheck, ESLint, and Next.js 16 build passed with 0 errors and 0 warnings.
- **Manual Follow-up**:
  - Run migration `supabase/migrations/20260918173000_correct_food_safety_cohort_participants.sql` in Supabase SQL editor to apply the database participant correction.

### 2026-09-18: Timetable Cohort Clash Diagnosis, Real-Time Conflict Detection & Shared Class Transparency

- **Context & Problem**:
  - Placing unit `DCU 1104 First Aid` for cohort `DHN-JAN-MAR-2025` threw an uninformative error: `Cohort clash: a participating cohort already has another session during the selected time`.
  - The HOD noted that `DHN-JAN-MAR-2025` had no class on Friday at 10:30.
  - The root cause was that `DCU 1104` is a **Shared Class** (`teaching_offerings`) taken jointly by multiple cohorts (e.g. `DHN` + `DND`). The DB trigger rejected placement because a partner cohort (or clinical rotation) was already occupied at that time, but the error message failed to identify which cohort was clashing.
  - Additionally, uncontrolled `<Select defaultValue=...>` inputs in `ScheduleAllocationDialog` reset back to `Monday` and `Morning Session · 08:00` upon error re-render.
- **Key Changes**:
  - `src/features/timetable-editor/schedule-allocation-dialog.tsx`:
    - Converted all inputs (`workingDayId`, `timeSlotId`, `trainerId`, `roomId`, `notes`, `isLocked`) to controlled React state so selections persist across errors.
    - Implemented instant client-side collision detection against all timetable sessions (`data.sessions`).
    - Explicitly detects and highlights whether the clash is with the primary cohort or a shared partner cohort (naming cohort code, unit code, trainer, and room).
    - Displays a "Shared Class" badge listing all participating cohorts when a unit is shared across multiple cohorts.
    - Added live availability indicator (`✓ Slot is completely available`) and blocked submission when a clash is present.
    - Resolved modal viewport overflow: Configured `DialogContent` with `max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden`, pinned `DialogHeader` and `DialogFooter` (`shrink-0`), and enabled smooth internal scrolling on `DialogBody` (`overflow-y-auto flex-1 min-h-0`). Dialog title, close button, and footer action buttons ("Cancel", "Schedule & Lock") remain 100% visible on all laptop resolutions.
  - `src/components/ui/dialog.tsx`:
    - Updated core `DialogContent` with `max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden`, pinned header/footer with `shrink-0`, and made `DialogBody` scrollable by default with `overflow-y-auto flex-1 min-h-0`.
  - `src/features/timetable-editor/session-editor-card.tsx`:
    - Updated session Move/Edit dialog to match the same viewport containment standards.
  - `src/features/timetable-editor/types.ts` & `src/features/timetable-editor/queries.ts`:
    - Extended `missingAllocations` in `EditorData` to include `participantCohortIds`, `participantCohortCodes`, and `isSharedClass`.
  - `src/features/timetable-editor/editor-workspace.tsx`:
    - Added a `Shared` badge on missing allocation cards to visually flag shared classes.
  - `src/features/timetable-editor/actions.ts`:
    - Added `diagnoseScheduleClash()` to perform comprehensive diagnostic queries whenever an allocation placement error occurs, returning human-readable conflict details (cohort code, unit code, trainer, room).
  - `supabase/migrations/20260918153000_hard_fix_timetable_manual_controls.sql`:
    - Updated `schedule_allocation_session_safely` to resolve all participant cohorts via `resolve_participant_cohort_ids` and return specific cohort/unit/trainer details upon clash.
    - Updated `validate_scheduled_session_conflicts()` trigger function to include specific cohort, unit, trainer, and room names in error messages system-wide.
- **Manual Follow-up**:
  - Run the updated `20260918153000_hard_fix_timetable_manual_controls.sql` in Supabase SQL editor if not already executed.

### 2026-09-18: Hard-Fix Master Timetable & Surgical Manual Scheduling Controls

- **Context & Problem**:
  - The HOD possesses an authoritative physical master timetable for `SEP-DEC-26` that is fixed and free of collisions.
  - Running the automated generator on draft sessions caused heuristics-based repositioning ("placing units anyhowly") and left unplaced sessions with conflict warnings.
  - The timetable editor lacked a bulk lock mechanism (requiring clicking individual padlocks up to 75 times) and provided no way to place missing allocations manually into a designated Day, Time Slot, and Room without triggering the auto-generator.
- **Files Added**:
  - `supabase/migrations/20260918153000_hard_fix_timetable_manual_controls.sql`:
    - `bulk_lock_department_timetable_sessions(target_academic_period_id uuid, target_lock_state boolean)`: Atomically locks/unlocks all active sessions for the working department, recording changes in `timetable_session_change_log`.
    - `schedule_allocation_session_safely(...)`: Atomically schedules an unplaced allocation to a specific working day, time slot, and room with full trainer, cohort, and room clash detection and immediate lock support.
    - `unschedule_session_safely(target_session_id uuid)`: Safely removes a placed session from the grid and returns the allocation to the unplaced pool for manual reassignment.
  - `src/features/timetable-editor/schedule-allocation-dialog.tsx`:
    - Interactive dialog component allowing the HOD to select a Day of Week, Time Slot, Room, and Trainer for any missing allocation, with an immediate "Hard-fix / Lock" toggle.
- **Files Modified**:
  - `src/features/timetable-editor/validation.ts`:
    - Added `bulkLockSchema` and `scheduleAllocationSchema` with Zod validation.
  - `src/features/timetable-editor/types.ts`:
    - Updated `missingAllocations` in `EditorData` to include `cohortId`, `unitId`, and `trainerId`.
  - `src/features/timetable-editor/queries.ts`:
    - Populated `cohortId`, `unitId`, and `trainerId` in `missingAllocations`.
  - `src/features/timetable-editor/actions.ts`:
    - Exported `bulkLockTimetableSessionsAction`, `scheduleAllocationSessionAction`, and `unscheduleSessionAction`.
  - `src/features/timetable-editor/session-editor-card.tsx`:
    - Updated locked card view with a distinct "Hard-Fixed" badge and 1-click "Unlock" button.
    - Added an "Unschedule" button in the edit dialog to remove misplaced sessions.
  - `src/features/timetable-editor/editor-workspace.tsx`:
    - Added a lock status badge (`X of Y Hard-Fixed`) and one-click "Lock All Sessions" / "Unlock All Sessions" buttons in the header.
    - Embedded `ScheduleAllocationDialog` on each card in "Units missing from timetable", enabling 1-click manual placement directly matching the physical timetable.
  - `src/tests/timetable-editor/validation.test.ts`:
    - Added unit test coverage for `bulkLockSchema` and `scheduleAllocationSchema`.
- **Manual Follow-up**:
  - Apply migration `supabase/migrations/20260918153000_hard_fix_timetable_manual_controls.sql` in the Supabase SQL Editor.

### 2026-09-18: Permanent Fix for Trainer Daily Report Visibility on HOD / Admin Operations

- **Root Causes**:
  1. The HOD operations page (`/operations/daily-reports`) defaulted strictly to `nairobiToday()`. When opening the portal the morning after a report was submitted, the view queried today's empty schedule by default, without any alert indicating reports had been submitted for yesterday.
  2. The database RPC `get_department_trainer_daily_reports` and backend queries strictly checked `report.home_department_id = active_department`. When a trainer taught lessons for the active department but had a `NULL` or external `department_id`, their submitted reports were completely filtered out from the HOD view.
  3. The `trainer_daily_reports_read` RLS policy previously only verified `current_user_can_manage_department(home_department_id)` without permitting access based on individual lesson department assignments.
  4. The TypeScript action fallback resolved `departmentId` to `firstDept?.id` when `trainer.department_id` was `NULL`, instead of inferring it from the day's scheduled lessons.
- **Files Added**:
  - `supabase/migrations/20260918070000_permanent_trainer_daily_report_visibility.sql`:
    - Updated `get_department_trainer_daily_reports` RPC so an HOD sees reports where `report.home_department_id = active_department` OR `EXISTS (SELECT 1 FROM trainer_daily_report_lessons WHERE report_id = report.id AND department_id = active_department)`.
    - Added full cross-department visibility for `system_admin`.
    - Updated `submit_trainer_daily_report_v1` with a `LEFT JOIN` on `departments` and automated inference of `department_id` from the day's scheduled sessions if null.
    - Updated `trainer_daily_reports_read` RLS policy to permit access if the user can manage any lesson's department in that report.
- **Files Modified**:
  - `src/features/trainer-daily-report/types.ts`:
    - Added `DepartmentRecentSubmissionDay` interface and `recentSubmissions?: DepartmentRecentSubmissionDay[]` to `DepartmentDailyReportWorkspace`.
  - `src/features/trainer-daily-report/queries.ts`:
    - Added query for `recentSubmissions` across the last 7 days.
    - Upgraded `getDepartmentDailyReports` filtering so reports containing lessons in the active department are never filtered out. Removed hardcoded `%nutrition%` string, using dynamic department matching.
  - `src/features/trainer-daily-report/actions.ts`:
    - When `trainer.department_id` is missing during submission fallback, dynamically inspects `workspace.lessons` to assign the proper department rather than defaulting to arbitrary first department.
  - `src/app/(dashboard)/operations/daily-reports/page.tsx`:
    - Added date navigation controls (`<`, `>`, `Yesterday`, `Today`, status pill) matching the trainer portal.
    - Added an alert banner notifying the HOD of reports submitted on recent dates (e.g. yesterday) awaiting review, with one-click navigation to view them.
- **Manual Follow-up**:
  - Apply migration `supabase/migrations/20260918070000_permanent_trainer_daily_report_visibility.sql` in the Supabase SQL Editor.

### 2026-09-17: Fix "Network error resetting student password" (404 on `/api/admin/students/[id]/reset-password`)

- **Root Cause**:
  - The "Reset student password" dialog in the UI calls `/api/admin/students/[id]/reset-password`. Because only `api/admin/trainers/[id]/reset-password` existed, calls for students failed with HTTP 404 (`Failed to load resource: the server responded with a status of 404 ()`), manifesting as `"Network error resetting student password."`
  - Additionally, student credentials in `student_portal_credentials` are hashed using bcrypt via `pgcrypto`, whereas legacy `set_student_portal_pin` only permitted 6-digit numeric PINs.
- **Files Added**:
  - `src/app/api/admin/students/[id]/reset-password/route.ts`:
    - POST handler gated behind HOD / system_admin authorization (`getAuthenticatedProfile`).
    - Accepts optional custom password (`password`, `customPassword`, `newPassword`, or `pin`), minimum 4 characters.
    - If blank or omitted, auto-generates a human-readable institutional temporary password (e.g. `Icmhs@xxxx`).
    - Primary write via `reset_student_portal_password` RPC, with automatic fallback to `activate_student_portal_account` RPC (which hashes with bcrypt) and `set_student_portal_pin` (if 6 digits).
    - Returns `{ success: true, password, pin, message }`.
  - `supabase/migrations/20260917220000_admin_reset_student_portal_password.sql`:
    - Added `reset_student_portal_password(target_student_id, plain_password)` RPC using `extensions.crypt(..., extensions.gen_salt('bf'))`.
  - `src/app/api/students/[studentId]/reset-password/route.ts`:
    - Aliased/delegated to the admin student reset handler to support both endpoint conventions seamlessly.
  - `src/features/students/reset-student-password-dialog.tsx`:
    - Client-side dialog matching production design: student name + admission number in header, optional custom password input, help text with `Icmhs@xxxx` example, copy button on success.
    - Targets `/api/admin/students/${studentId}/reset-password`.
- **Files Modified**:
  - `src/app/(dashboard)/students/registry/[studentId]/page.tsx`:
    - Added `<ResetStudentPasswordDialog>` button into the `PageHeader` actions alongside `EditAdmissionNumberDialog` and "View as Student".
- **Manual Follow-up**:
  - Run SQL migration `supabase/migrations/20260917220000_admin_reset_student_portal_password.sql` in Supabase SQL Editor.

### 2026-09-17: Native Mobile UI Polish for Class Attendance & Trainer Daily Report
- **User Requirements & Design Implemented**:
  - Render student name formatted to two primary names (`formatStudentTwoNames`), with admission number placed directly below the name in smaller font.
  - Present and Absent toggle controls aligned strictly on the SAME horizontal line/row as student info (`flex items-center justify-between`) across all devices (mobile and desktop).
  - Native tactile segmented toggle buttons for Present and Absent (`active:scale-95`, solid emerald for Present, solid rose for Absent).
  - Responsive native card layout for the Absentees Register in the Trainer Daily Report and HOD Daily Report lists.
  - Codified non-negotiable Zero-Regression & Working Code Protection Policy across `CHANGES.md` and `AGENTS.md`.
- **Files Modified**:
  - `src/features/class-attendance/domain.ts`:
    - Added `formatStudentTwoNames(fullName?: string | null): string`.
  - `src/features/trainer-daily-report/domain.ts`:
    - Re-exported `formatStudentTwoNames`.
  - `src/features/class-attendance/attendance-editor.tsx`:
    - Updated student roster item to native 1-line layout: student 2 names on top, smaller admission number below, and Present/Absent toggle controls aligned horizontally on the same line.
    - Implemented a single compact toggle button for small screens (`sm:hidden`) that defaults to green "Present" and turns red "Absent" on tap, giving maximum horizontal width for the student's name on a single line without wrapping. Larger screens (`sm+`) retain the dual segmented toggle.
    - Added left accent border (`border-l-[3px] border-l-rose-500`) and compact circumstance selector when marked absent.
  - `src/features/trainer-daily-report/trainer-form.tsx`:
    - Updated ScheduledLessonsSection with native pill badges for roster, present, and absent counts.
    - Updated AbsenteesTableSection with responsive native mobile card layout and clean desktop table combining student 2 names and admission number in 1 cell.
  - `src/features/trainer-daily-report/hod-report-list.tsx`:
    - Updated `AbsenteeList` to display student 2 names with admission number below in smaller font.
  - `src/tests/class-attendance-domain.test.ts`:
    - Added unit test cases verifying `formatStudentTwoNames`.
  - `AGENTS.md` & `CHANGES.md`:
    - Added non-negotiable regression prevention rule.

### 2026-09-17: Fix Student Portal Dashboard Crash Due to Undefined Navigation Icon in Mobile Nav
- **Root Cause**:
  - In `src/components/student/student-portal-shell.tsx`, `MOBILE_NAV_ITEMS` was deriving its items via index lookups into `NAVIGATION_ITEMS` (`{ ...NAVIGATION_ITEMS[6], tabKey: 'profile' }`).
  - When the Attendance navigation item was commented out in `NAVIGATION_ITEMS`, the array length reduced from 7 to 6 items (indices 0 to 5), causing `NAVIGATION_ITEMS[6]` to evaluate to `undefined`.
  - In mobile viewports, rendering `<Icon />` where `Icon` was `undefined` threw React's fatal element error (`Element type is invalid: expected a string or a class/function but got: undefined`).
  - This error specifically occurred for authenticated students because admin portal preview (`isAdminPreview = true`) returns an un-shelled container early and skips mobile navigation rendering entirely.
- **Files Modified**:
  - `src/components/student/student-portal-shell.tsx`:
    - Defined `MobileNavigationItem` interface and replaced brittle array indexing with explicit declarations for all 4 mobile nav entries (`Dashboard`, `Registration`, `Timetable`, `Profile`).
    - Adjusted mobile navigation bar grid container from `grid-cols-4` to `grid-cols-5` to cleanly accommodate the 4 navigation links plus the "More" drawer toggle button.

### 2026-09-17: Fix Student Portal Activation Crash on Stale Session Cookies & Add Student Error Boundary
- **Root Cause**:
  - In Next.js App Router (React Server Components), modifying cookies during rendering via `cookies().delete()` or `cookies().set()` throws an invariant exception: `Cookies can only be modified in a Server Action or Route Handler`.
  - When a user visited `/student/activate` or `/student/login` with an expired, revoked, or stale `ams_student_session` cookie (e.g. from previous tests), `getStudentPortalSession()` encountered `!data || data.revoked_at` and called `store.delete(COOKIE_NAME)`.
  - Because `/student/activate` is a Server Component, this threw an unhandled 500 error that bubbled to the root `src/app/error.tsx` ("Something went wrong"). The cookie was never deleted because the response aborted, causing the error to loop indefinitely on page reload.
- **Files Added**:
  - `src/app/student/logout/route.ts`: Dedicated GET route handler (`/student/logout`) that cleanly deletes `ams_student_session` and redirects to `/student/login`.
- **Note on Error Boundaries**:
  - Removed `src/app/student/error.tsx` because in Next.js App Router, placing an `error.tsx` directly in a route segment catches server-side `redirect()` calls (which throw internal `NEXT_REDIRECT` exceptions), blocking automatic redirect from `/student` to `/student/login`. Root `src/app/error.tsx` and Next.js navigation handle errors outside of intentional redirects.
- **Files Modified**:
  - `src/features/student-portal/session.ts`:
    - Added `safeDeleteCookie()` utility that gracefully catches cookie mutations during Server Component rendering.
    - Wrapped `getStudentPortalSession()` and `revokeStudentPortalSession()` in resilient `try/catch` blocks returning `null` safely upon any unexpected session or database lookup failure.
  - `src/app/student/page.tsx`:
    - Added individual `.catch()` handlers to all parallel queries in `Promise.all()` to prevent a single query failure from taking down the entire student dashboard.

### 2026-09-17: Fix Drop Offering Authorization & Student Portal Access Route
- **Files Added**:
  - `supabase/migrations/20260917140000_fix_drop_offering_and_student_portal_access.sql`:
    - Added explicit `drop function if exists` for `set_unit_offering_approval` and `get_student_portal_access_register` to accommodate PostgreSQL's restriction on altering return types (from `integer` to `jsonb`) in `CREATE OR REPLACE FUNCTION`.
    - Updated `current_user_can_access_department()` to unconditionally allow `system_admin` role, preventing department lockouts when profile `active_department_id` is null or re-selected.
    - Updated `get_student_portal_access_register()` with fallback to first manageable department if user's primary department is unset.
    - Updated `set_unit_offering_approval()` to:
      1) Accept any department the user is authorized to manage (`programme.department_id = active_department OR current_user_can_manage_department(programme.department_id)`).
      2) Safely cancel live timetable draft sessions for dropped units rather than aborting the entire transaction when sessions exist.
      3) Return a structured JSONB payload (`changed`, `blocked`, `blocked_ids`, `message`) instead of an all-or-nothing runtime exception.
- **Files Modified**:
  - `src/features/unit-offerings/approval-actions.ts`:
    - Handled the `set_unit_offering_approval` JSONB return structure.
    - Surfaced detailed warning/partial success alerts when specific offerings are skipped.
    - Removed duplicate `addCohortUnitOfferingAction` declaration.
  - `src/app/(dashboard)/timetable/unit-offerings/page.tsx`:
    - Added `approvalWarning` Alert banner to display partial authorization feedback.
  - `src/app/(dashboard)/students/access/page.tsx`:
    - Wrapped `getStudentPortalAccessRegister()` in resilient try/catch block to render an informative error alert banner rather than crashing to Next.js `error.tsx` root boundary.
  - `src/lib/validation/environment.ts`:
    - Added fallback to `NEXT_PUBLIC_SUPABASE_ANON_KEY` if `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is not present, preventing unexpected configuration crashes across diverse hosting setups.
  - `.env.example`:
    - Documented both `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and legacy alias `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Manual Follow-up**:
  - Run the SQL migration `supabase/migrations/20260917140000_fix_drop_offering_and_student_portal_access.sql` in the Supabase SQL Editor.
  - Ensure Vercel and Cloudflare environment variables have been updated with the new `SUPABASE_SERVICE_ROLE_KEY` and redeployed.

### 2026-09-17: Strict Single-Line Admission Number Formatting Across All Sheets & Exports
- **Files Modified**:
  - `src/features/assessment/attendance-sheet-pdf.tsx`:
    - Widened admission number column width constants across all PDF orientations/layouts: `COL_CLASS_ADM` from 92pt to 126pt (+34pt, 37% increase; compensated by adjusting name and index column proportions), `COL_EXAM_ADM` to 126pt, and `COL_CAT_ADM` to 126pt.
    - Preserved zero-hyphenation behavior via `Font.registerHyphenationCallback((word) => [word])`.
  - `src/features/assessment/attendance-sheet-docx.ts`:
    - Widened Word document admission number column widths from 1900/2000 dxa to 2200/2300 dxa in Exam and CAT attendance tables.
  - `src/features/assessment/printable-signing-sheet.tsx`:
    - Widened admission number colgroup width from `w-36` to `w-44` (176px) and added `whitespace-nowrap font-semibold` to table cells.
  - `src/features/class-attendance/printable-class-register.tsx`:
    - Widened `<col className="w-32" />` to `<col className="w-44" />` (176px) and applied `whitespace-nowrap font-semibold`.
  - `src/features/assessment/markbook-generator.ts`:
    - In `createCohortSheet`, increased admission column width to 28 and configured `row.eachCell` to set `wrapText: colNumber !== 2` so Excel does not wrap admission numbers at hyphens or slashes.
    - In historical/online markbook sheet, increased admission column width from 18 to 28 and disabled `wrapText` on column 2.
  - `src/features/assessment/marks/workbook.ts`:
    - Increased `Admn No.` column widths from 20 and 22 to 28 in both exam and CAT marks workbooks.
    - Updated `bodyCellStyle` to accept column numbers and set `wrapText: colNumber !== 2`.
  - `src/features/assessment/signing-sheet-generator.ts`:
    - Increased admission number column width from 20 to 28 in Excel signing sheets and updated `row.eachCell` to enforce `wrapText: colNumber !== 2`.
  - `src/app/api/assessment/[assessmentId]/attendance-sheet/route.ts`:
    - Widened Excel admission column from 24 to 28 and disabled `wrapText` on column 2.
  - `src/app/api/assessment/analysis/[assessmentId]/export/route.ts`:
    - Widened student results admission number column to 28.
  - `src/app/api/attendance-clinical/class-attendance/export/route.ts`:
    - Increased admission number column width from 22 to 28 and disabled `wrapText` for column 2.
  - `src/app/api/students/export/route.ts`:
    - Increased admission column width from 24 to 28.
  - `src/app/api/students/reports/export/route.ts`:
    - Increased admission column width from 24 to 28 and disabled `wrapText` for column 1.
  - `src/app/api/students/portal-access/issue/route.ts`:
    - Increased admission column width from 24 to 28.
  - `src/app/(dashboard)/assessment/population/[assessmentId]/page.tsx`:
    - Added `whitespace-nowrap font-mono` to admission number cells and headers.
  - `src/features/staff-assessment/online-marks-editor.tsx`:
    - Added `whitespace-nowrap font-mono` to admission number badges.
  - `src/features/students/student-registry-table.tsx`:
    - Added `whitespace-nowrap` to admission number text.
  - `src/features/trainer-daily-report/trainer-form.tsx`:
    - Added `whitespace-nowrap` to absentee roster admission numbers.
  - `src/features/student-reporting-sync/reporting-sync-dialog.tsx`:
    - Added `whitespace-nowrap` to sync preview rows.
  - `src/app/(dashboard)/assessment/marks/import/[batchId]/page.tsx`:
    - Added `whitespace-nowrap font-mono` to marks import table cells.
- **Verification Evidence**:
  - `npm test`: All 117 test files and 589 unit tests passing.
  - `npm run check`: `tsc --noEmit`, ESLint, and Next.js 16 production build passed with 0 errors.

### 2026-09-17: Fix Batch Cross-Stage Registration Cohort Selection & Enum Casting
- **Files Modified / Deployed**:
  - `supabase/migrations/20260916170000_fix_cross_stage_registration_offering_enums.sql`:
    - Deployed to remote Supabase database (`npx supabase db push --yes`). Fixed runtime PostgreSQL error `column "selection_state" is of type public.unit_offering_selection_state but expression is of type text` by adding explicit enum casts to `batch_register_override_units`.
  - `src/features/student-unit-registration/batch-actions.ts`:
    - Added cohort-mode fallback in `batchRegisterOverrideUnits`: when registering in "Entire cohort" mode, if explicit student checkbox IDs are not posted, the action queries and registers all active/admitted students in that cohort automatically.
  - `src/features/student-unit-registration/batch-unit-registration.tsx`:
    - Fixed state synchronization when switching between "Stage curriculum" and "Additional / cross-stage units": student selection set now automatically recalculates based on the active path (`canRegister` vs `eligible`).
    - Upgraded primary registration submit button styling with clear high-contrast primary action colors (`bg-primary text-white`).
- **Verification Evidence**:
  - `npm test`: 117 test files, 589 tests passed.
  - `npm run check`: Typecheck, ESLint, and Next.js 16 build passed with 0 errors.
  - Live database integration test for `batch_register_override_units` and `add_special_unit_offering` executed with 100% success.

### 2026-09-16: Unit Table Programme Filter Completion
- **Files Modified**:
  - `src/features/units/unit-table.tsx`
  - `CHANGES.md`
- **What Changed**:
  - Added the supplied programme selector to the Units table toolbar, filtering by programme and resetting the dependent year/semester selection when the programme changes.
  - Removed unused room-type helpers and icon imports left over from the table redesign.
- **Breaking Changes / Manual Follow-ups**: None.

### 2026-09-16: Registered-Student Attendance Roster Enforcement
- **Files Added/Modified**:
  - `supabase/migrations/20260916150000_registered_students_are_reported.sql` [NEW]
  - `src/app/api/staff/attendance/sessions/route.ts`
  - `src/features/class-attendance/attendance-editor.tsx`
  - `src/features/class-attendance/domain.ts`
  - `src/features/class-attendance/queries.ts`
  - `src/features/class-attendance/types.ts`
  - `src/features/trainer-daily-report/actions.ts`
  - `src/features/trainer-daily-report/queries.ts`
  - `src/features/trainer-daily-report/trainer-form.tsx`
  - `src/features/trainer-daily-report/types.ts`
  - `src/tests/class-attendance-domain.test.ts`
  - `CHANGES.md`
- **What Changed**:
  - Unit registration is now the authoritative class-roster decision: existing and future registered students are automatically recorded as reported for their academic period.
  - Class sessions reconcile every registered student into trainer attendance, class attendance sheets, and daily-report attendance. Students who do not attend should be unregistered from the unit rather than excluded by a separate reporting flag.
  - Replaced the retired `Not Reported` attendance state with the two trainer choices, **Present** and **Absent**. All registered students start as Present; trainers mark only absences.
  - Migrated legacy `not_reported` attendance and daily-report counts into Present, and added a database guard that normalizes any legacy writer still emitting that retired status.
- **Breaking Changes / Manual Follow-ups**:
  - Run `npx supabase db push` to apply `20260916150000_registered_students_are_reported.sql` before relying on the updated roster behavior in production.

### 2026-09-16: PDF-Only Attendance Sheets & Print Contrast Upgrade
- **Files Modified**:
  - `src/app/api/staff/units/[allocationId]/attendance-sheet/[type]/route.ts`
  - `src/app/(staff)/staff/units/[allocationId]/page.tsx`
  - `src/app/(staff)/staff/units/[allocationId]/documents/page.tsx`
  - `src/features/assessment/attendance-sheet-pdf.tsx`
  - `src/features/assessment/printable-signing-sheet.tsx`
  - `src/features/class-attendance/printable-class-register.tsx`
  - `src/features/staff-downloads/staff-downloads-view.tsx`
  - `src/tests/operations-attendance-oversight.test.ts`
  - `CHANGES.md`
- **What Changed**:
  - Removed Word downloads for class, CAT, and examination attendance sheets. The export endpoint now always produces a PDF, including requests made through legacy DOCX links.
  - Updated every trainer-facing sheet action to use PDF download.
  - Refined the class attendance PDF header cells by removing `Session 1` through `Session 8`, leaving left-aligned `Date` writing space instead.
  - Strengthened PDF table outlines and internal grid lines to dark, high-contrast borders suitable for black-and-white printing.
- **Breaking Changes / Manual Follow-ups**: None.

### 2026-09-16: Controlled Cross-Stage Student Unit Registration
- **Files Added/Modified**:
  - `supabase/migrations/20260916160000_controlled_cross_stage_unit_registration.sql` [NEW]
  - `src/app/(dashboard)/students/unit-registration/batch/page.tsx`
  - `src/app/(dashboard)/students/unit-registration/register/[studentId]/page.tsx`
  - `src/features/student-unit-registration/actions.ts`
  - `src/features/student-unit-registration/batch-actions.ts`
  - `src/features/student-unit-registration/batch-queries.ts`
  - `src/features/student-unit-registration/batch-types.ts`
  - `src/features/student-unit-registration/batch-unit-registration.tsx`
  - `src/features/student-unit-registration/queries.ts`
  - `CHANGES.md`
- **What Changed**:
  - Preserved programme-stage bindings as the standard, automatic registration path while adding an HOD-controlled override path for missed, repeat/carry-over, and approved future-stage units.
  - Individual registration no longer requires a current stage before the programme curriculum can be selected. Selecting any off-stage unit requires a recorded HOD reason.
  - Batch registration now includes an **Additional / cross-stage units** mode for selected students or an entire cohort. It offers all active departmental curriculum units, registers only same-programme matches, auto-provisions cohort offerings, and records the override reason on every registration.
  - Kept lifecycle and department authorization safeguards: only admitted/active students in a current cohort and units belonging to their programme can be processed.
- **Breaking Changes / Manual Follow-ups**:
  - Run `npx supabase db push` to apply `20260916160000_controlled_cross_stage_unit_registration.sql` before using batch cross-stage registration in production.

### 2026-09-16: Fix Cross-Stage Batch Registration Enum Writes
- **Files Added/Modified**:
  - `supabase/migrations/20260916170000_fix_cross_stage_registration_offering_enums.sql` [NEW]
  - `CHANGES.md`
- **What Changed**:
  - Replaced the batch cross-stage registration RPC with explicit PostgreSQL enum casts for unit-offering state, status, type, origin, and student registration status.
  - This fixes the runtime error raised when PostgreSQL interpreted the `INSERT ... SELECT` literals as plain text instead of the required enum values.
- **Breaking Changes / Manual Follow-ups**:
  - Run `npx supabase db push` to apply `20260916170000_fix_cross_stage_registration_offering_enums.sql`. It is safe to apply after the original cross-stage registration migration.

### 2026-09-16: Global Readability Typography
- **Files Modified**:
  - `src/app/globals.css`
  - `CHANGES.md`
- **What Changed**:
  - Standardized the application on a modern, platform-native UI font stack, prioritizing Inter when it is already available and falling back to each operating system's clearest system font without a network dependency.
  - Added legibility defaults for body copy and controls: consistent line height, kerning, numeric rendering, and platform font smoothing.
  - Added a dedicated monospaced stack with tabular numerals for codes, identifiers, and other structured data.
- **Breaking Changes / Manual Follow-ups**: None.

### 2026-09-16: Fix Timetable vs Class Session Time Mismatch & Milkah Daily Reports
- **Files Modified**:
  - `src/app/api/staff/attendance/sessions/route.ts`:
    - Fixed hardcoded `'08:00:00'` and `'10:00:00'` in fallback `class_sessions` creation. Start and end times are now dynamically resolved from `time_slots(starts_at, ends_at)` and the published timetable version snapshot.
  - `src/app/api/staff/attendance/sessions/exception/route.ts`:
    - Fixed query selecting `'start_time, end_time'` from `time_slots` (which does not exist) to the actual schema column names `'starts_at, ends_at'`, and added published timetable snapshot fallback.
- **Database Remediation**:
  - Corrected all 14 historical `class_sessions` in September that had mismatched `08:00:00 - 10:00:00` times so they now accurately reflect their scheduled timetable times (`10:30:00 - 12:30:00` or `14:00:00 - 16:00:00`).
  - Logged official cancellation exceptions for Milkah Wambui for the 10 orientation-window sessions between Sept 1 and Sept 11, clearing her overdue blocking state.
  - Formally submitted Milkah's completed daily reports for Monday (2026-09-14, Diet Therapy I, 23 students) and Tuesday (2026-09-15, Diet Therapy II, 13 students). Milkah's reports now render in full on the HOD Admin Daily Reports table (`/operations/daily-reports`).
- **Verification Evidence**:
  - `npm test`: 117 test files, 589 tests passed.
  - `npm run check`: Typecheck, ESLint, and Next.js 16 build passed with 0 errors.
  - Verified 0 time mismatches remaining across all 26 class sessions in September.
  - Verified HOD daily report view renders Milkah Wambui under submitted reports for both 2026-09-14 and 2026-09-15.

### 2026-09-16: Fix Overdue Daily Report 1-Click Submission & Client State Persistence
- **Files Modified**:
  - `src/features/trainer-daily-report/actions.ts`:
    - Added `submitDailyReportDirectAction(reportDate)`: a 1-click server action allowing trainers to submit completed past daily reports directly without leaving the current day's workspace.
    - Updated lesson completion validation in `submitDailyReportDirectAction` to verify that all lessons on the specified date have attendance recorded or cancelled (`lessonsComplete`), ensuring unsubmitted past dates can be resolved sequentially without deadlock.
    - Added multi-page revalidation (`/staff/daily-report`, `/staff/attendance`, `/operations/daily-reports`).
  - `src/features/trainer-daily-report/trainer-form.tsx`:
    - **1-Click Submit Button**: Upgraded the overdue banner action from a passive `<Link>` into a real 1-click interactive button that calls `submitDailyReportDirectAction(report.reportDate)` with spinning loading indicator (`<LoaderCircle>`), plus a separate "Review" link.
    - **Auto-Redirect on Past Report Submission**: Added auto-redirection in `useEffect` when submitting a historical report (`workspace.reportDate !== today`), taking the trainer back to `/staff/daily-report` (today) with cache refreshed so the overdue banner disappears immediately.
    - **Visible Error Feedback**: Added prominent submission error banner (`state.status === 'error'`) inside the daily report form to display `state.message` whenever server action validation fails.
  - `src/features/trainer-daily-report/queries.ts`:
    - Passed both `trainer_id` and `trainer_profile_id` when checking for submitted reports in `detectPastUnrecordedReportsAndSessions` to ensure historical reports submitted under either identifier are recognized.
- **Verification Evidence**:
  - `npm test`: 117 test files, 589 tests passed.
  - `npm run check`: Typecheck, ESLint, and Next.js 16 build passed with 0 errors.
  - Verified Wilfred Osozi's 2026-09-15 daily report successfully submitted and confirmed via live database query.

### 2026-09-15: Fix Overdue Attendance Report "Submit Report" Persistence & Cancelled Session Flow
- **Files Modified/Added**:
  - `src/features/trainer-daily-report/queries.ts`:
    - **Cleared Phantom Unsubmitted Reports**: Updated `detectPastUnrecordedReportsAndSessions` to require `info.completed > 0` before classifying past dates as unsubmitted daily reports. Historical dates where 100% of sessions were marked "Did Not Take Place" (`status = 'cancelled'`) no longer trigger phantom unsubmitted daily report blockers.
    - **Reconciled Cancelled Sessions in Workspace**: Added direct reconciliation with `class_sessions` in `getTrainerDailyReportWorkspace` so cancelled sessions correctly reflect `attendanceStatus = 'cancelled'` (rather than being ignored as `not_started`), allowing daily reports with cancelled sessions to calculate `readyToSubmit = true`.
  - `src/features/trainer-daily-report/trainer-form.tsx`:
    - **Direct Session Exception Action**: Added a direct "Did Not Take Place" action button onto scheduled lesson cards, allowing trainers to log session exceptions immediately without waiting for sessions to become overdue.
    - **Generalized Exception Dialog**: Expanded `SessionExceptionDialog` to accept both past unrecorded sessions and active lesson cards via `ExceptionTargetSession`.
  - `src/app/api/staff/attendance/sessions/exception/route.ts`:
    - **Robust Foreign Key Resolution**: Resolved `trainer_id` referencing `trainers.id` instead of raw user profile IDs.
    - **Time Slot Resolution**: Resolved exact `starts_at` and `ends_at` from `time_slots` when available.
    - **Cache Invalidation**: Added `revalidatePath('/staff/daily-report')` and `revalidatePath('/staff/attendance')`.
  - `src/features/trainer-daily-report/actions.ts`:
    - **Upgraded Submission Pipeline**: Added prioritized call to `submit_trainer_daily_report_v1` (which recognizes `status in ('completed', 'cancelled')`) with fallback to `submit_trainer_daily_report`.
    - **Direct Fallback Roster Snapshots**: Ensured fallback upserts to `trainer_daily_reports` also populate `trainer_daily_report_lessons` with full roster, present, absent, not reported, and absentee snapshots.
  - `supabase/migrations/20260915141000_fix_cancelled_sessions_in_daily_report_workspace.sql` [NEW]:
    - Updated `get_trainer_daily_report_workspace` and `submit_trainer_daily_report_v1` to eliminate `and session.status <> 'cancelled'`, and added wrapper function `submit_trainer_daily_report`.
- **Verification Evidence**:
  - `npm test`: 117 test files, 589 tests passed.
  - `npm run check`: Typecheck, ESLint, and Next.js 16 production build passed with 0 errors across all routes.
  - Supabase database audit confirmed 16 past dates with cancelled sessions are no longer flagged as phantom unsubmitted reports.

### 2026-09-15: Admin Sidebar Upgrade — Grouped Sections, Core Modules & Collision-Proof Matching
- **Files Modified**:
  - `src/components/layout/admin-sidebar.tsx`:
    - **Structured Grouping**: Organized navigation into 4 logical, clean enterprise sections: *Operations* (Dashboard, Daily Operations, Class Attendance, Action Centre), *Academics & Quality* (Academic Planning, Unit Registration, Quality Assurance, Grading & Results, Reports), *Faculty & Students* (Staff & Trainers, Student Registry), and *System* (Settings).
    - **Added Missing Core Modules**: Added direct 1-click links to **Class Attendance** (`/attendance-clinical/class-attendance`, icon: `CheckCircle2`), **Staff & Trainers** (`/trainers`, icon: `Users`), and **Student Registry** (`/students/registry`, icon: `UserCheck`).
    - **Collision-Proof Active Route Matching**: Implemented `isNavItemActive` using longest-matching-prefix resolution. Solved active state route collision bugs where sub-routes (`/timetable/reports`, `/timetable/organization`, `/operations/action-center`) previously caused both the child and parent navigation items to highlight active simultaneously.
    - **Trainer Portal Quick Link**: Added direct "My Trainer Workspace" (`/staff`) link in the sidebar footer directly above Sign Out, enabling HODs to jump to their teaching allocations with 1 click.
    - **Refined Branding**: Updated header title from narrow "Academic Planning" to comprehensive "Department Management".
  - `src/tests/admin-dashboard-design.test.ts`:
    - Updated navigation specification test assertions to verify all 12 items, their target paths, and added comprehensive active route matching tests covering exact paths, sibling prefix disambiguation, and nested subroutes.

### 2026-09-15: 80% College Minimum Attendance Policy & Student Portal Missed Lessons View
- **Files Modified/Added**:
  - `src/features/attendance-analytics/domain.ts`: Added `COLLEGE_MINIMUM_ATTENDANCE_PERCENT = 80.0` constant. Added `AttendanceStanding` type (`good` $\ge 85\%$, `borderline` $80\text{–}84.9\%$, `at_risk` $< 80\%$, `unrecorded`) and helper functions `getAttendanceStanding`, `getAttendanceStandingLabel`, and `getAttendanceBadgeVariant` enforcing the official college 80% minimum attendance policy for examination/CAT clearance.
  - `src/tests/attendance-analytics-domain.test.ts`: Added unit tests verifying boundary classifications for the 80% college requirement (`79.9%` $\rightarrow$ `at_risk`, `80.0%` & `84.9%` $\rightarrow$ `borderline`, `85.0%` & `100%` $\rightarrow$ `good`).
  - `src/features/attendance-analytics/hod-attendance-view.tsx` [NEW]: Created interactive dual-view client component for HOD analytics (`/attendance-clinical/class-attendance/analytics`), enabling switching between Student Attendance and Unit Overview. Includes student name/admission search, cohort filter, status filter chips (`All`, `At Risk < 80%` with direct warning count button, `Borderline 80–84%`, `Good Standing ≥ 85%`), attendance rate progress bars, and official college policy callout.
  - `src/app/(dashboard)/attendance-clinical/class-attendance/analytics/page.tsx`: Embedded `HodAttendanceView` passing aggregated unit data and detailed student rosters, along with college attendance policy footnote.
  - `src/components/student/student-portal-shell.tsx`: Temporarily hid the direct `Attendance` link from the student portal sidebar and mobile navigation drawer as instructed ("implement student view fully but first hide it"), keeping the portal uncluttered while retaining the route.
  - `src/features/student-portal/student-attendance-view.tsx` [NEW]: Created comprehensive student attendance view showing overall attendance rate, 80% college exam clearance threshold indicator, unit-by-unit breakdown, and filterable session history (All Classes vs Missed Lessons).
  - `src/app/student/attendance/page.tsx`: Updated student attendance page with full policy enforcement, badge indicators, and lesson filtering.
  - `src/app/student/page.tsx`: Updated main student dashboard to display a high-priority **Missed Lessons Alert** card showing any class session marked absent (with date, time, unit, and cohort) and clear warning regarding the college 80% exam debarment threshold.

### 2026-09-15: Unit Code Below Unit Name & Departmental Trainer Filtering for Daily Reports
- **Files Modified**:
  - `src/features/trainer-daily-report/hod-report-list.tsx`: Removed leading unit code prefix from the top line and positioned the unit code cleanly directly below the unit name in subtle monospace font, with the session time beneath.
  - `src/app/(dashboard)/operations/daily-reports/print/page.tsx`: Updated print table unit cell to place unit name on top, unit code below, and session time underneath.
  - `src/features/trainer-daily-report/export-docx.ts`: Updated Word export table to stack unit name, unit code, and session time into cleanly spaced separate paragraph lines.
  - `src/features/trainer-daily-report/trainer-form.tsx`: Harmonized trainer daily report form review and summary tables to display unit name first with unit code underneath.
  - `src/features/trainer-daily-report/queries.ts`: Filtered `getDepartmentDailyReports` so `expectedTrainers`, `submittedReports`, and `pendingTrainers` strictly include only trainers belonging to the active department (Department of Human Nutrition and Dietetics). Excluded all external trainers from other departments (Applied Sciences, Health Records, Perioperative Theatre, Health & Social Sciences) who teach service units or have unrelated allocations. Upgraded direct database fallback to load `trainer_daily_report_lessons` with full absentee student rosters.
  - `supabase/migrations/20260914235000_filter_daily_reports_by_nutrition_department.sql`: Added PostgreSQL migration updating `public.get_department_trainer_daily_reports` function to restrict `expected`, `submitted`, `lesson_count`, `absence_count`, `concern_count`, and `reports_payload` to `trainer.department_id = active_department` and `report.home_department_id = active_department`.

### 2026-09-14: Balanced Daily Report Table Design & Dynamic Multi-Column Absentee Scaling
- **Files Modified**:
  - `src/features/trainer-daily-report/domain.ts`: Updated `getAbsenteeColumnClass` to dynamically scale up to 4 columns (`grid-cols-1`, `sm:grid-cols-2`, `md:grid-cols-3`, `xl:grid-cols-4`) for large absentee populations ($\ge 17$ students), and updated `formatAbsenteeLine` for clean 1-line display.
  - `src/features/trainer-daily-report/hod-report-list.tsx`: Streamlined table to 4 balanced columns (`Unit & Time` `w-[230px]`, `Present` `w-[60px]`, `Absent` `w-[60px]`, and `Absentees` remaining $\sim 70\%$ width). Removed the standalone `Class` column that previously ballooned row height across multi-cohort badges. Combined unit details and session time into a single structured cell. Removed truncation from student names so full names and admission numbers are visible in full.
  - `src/app/(dashboard)/operations/daily-reports/print/page.tsx`: Updated print view table to 4 columns (`w-[26%]`, `w-[6%]`, `w-[6%]`, `w-[62%]`). Removed `Class` column. Formatted absentee students into 1–4 straight print columns with full names and admission numbers without truncation.
  - `src/features/trainer-daily-report/export-docx.ts`: Updated Word export table headers and column widths (Unit & Time at 26%, Absentees at 60%). Combined unit and session time into a clean paragraph stack.
  - `src/tests/trainer-daily-report-domain.test.ts`: Added unit tests verifying responsive column scaling for 0, 3, 5, 8, 12, 16, 17, and 32 absentees, and formatting of student details with circumstance notes.
- **Verification Evidence**:
  - `npx vitest run src/tests/trainer-daily-report-domain.test.ts`: 6/6 tests passed.
  - `npm run check`: Typecheck, ESLint, and Next.js 16 production build passed with 0 errors across all routes.

### 2026-09-14: Daily Report Template Upgrade & Trainer Past Report Enforcement
- **Files Modified**:
  - `src/features/trainer-daily-report/hod-report-list.tsx`: Upgraded HOD daily report view (`/operations/daily-reports`) with proportional table columns (`table-fixed`), maximized space allocation for absentees, and a straight multi-column absentee grid (`grid-cols-1`, `md:grid-cols-2`, `xl:grid-cols-3` depending on volume) ensuring each student's details occupy strictly 1 line per row per column with student name, monospace admission number, and circumstance note pill.
  - `src/app/(dashboard)/operations/daily-reports/print/page.tsx`: Upgraded print view (`/operations/daily-reports/print`) with proportional table column widths (`w-[12%]`, `w-[18%]`, `w-[14%]`, `w-[6%]`, `w-[6%]`, `w-[44%]`), replacing semi-colon string blobs with crisp 1-3 straight print columns (`grid-cols-1`, `grid-cols-2`, `grid-cols-3`).
  - `src/features/trainer-daily-report/export-docx.ts`: Adjusted Word document export table column widths (Absentee Students increased to 40%) and formatted each absentee student as a distinct bulleted line/paragraph in half-points with optional circumstance tags.
  - `src/features/trainer-daily-report/types.ts`: Added `PastUnsubmittedReportDate` and updated `TrainerDailyReportWorkspace` to track unsubmitted past daily reports.
  - `src/features/trainer-daily-report/domain.ts`: Added `getAbsenteeColumnClass` and `formatAbsenteeLine` utility helpers.
  - `src/features/trainer-daily-report/queries.ts`: Implemented `detectPastUnrecordedReportsAndSessions` with strict overdue enforcement ($\ge 1$ day overdue, eliminating the 2-day bypass loophole) and tracked unsubmitted past daily reports.
  - `src/features/trainer-daily-report/trainer-form.tsx`: Enhanced `PastUnrecordedBanner` to report both unsubmitted past reports and unrecorded sessions with 1-click resolution actions; guarded the "Take Attendance" button on new classes when previous reports/sessions are pending; enforced blocking on non-teaching days.
  - `src/features/trainer-daily-report/actions.ts`: Enforced strict validation in `submitTrainerDailyReportAction` blocking any report submission if overdue unrecorded sessions or unsubmitted reports exist.
  - `src/app/api/staff/attendance/sessions/route.ts`: Enforced chronological compliance in `POST /api/staff/attendance/sessions`, blocking creation of attendance sessions for new dates if older unrecorded sessions exist.
  - `src/tests/trainer-daily-report-domain.test.ts`: Added unit tests covering absentee column classes and single-line student detail formatting.
- **Verification Evidence**:
  - `vitest run src/tests/trainer-daily-report-domain.test.ts`: 6/6 tests passed.
  - `npm test`: 117/117 test files passed, 585/585 tests passed.
  - `npm run check`: Typecheck, ESLint, and Next.js 16 production build passed with 0 errors across all routes.

### 2026-09-14: Trainer Table Action Cleanliness & Premium Trainer Profile Redesign
- **Files Modified**:
  - `src/features/trainers/trainer-table.tsx`
  - `src/features/trainers/actions.ts`
  - `src/app/(dashboard)/trainers/[id]/page.tsx`
- **What Changed**:
  - **Trainer Table Streamlining**:
    - Removed the three circular action buttons (`Edit`, `Toggle Availability`, `Deactivate / Activate`) and `Staff Portal` eye icon from the table rows.
    - Replaced with a single clean, high-density `Profile` button on each row, eliminating visual clutter across the 26+ trainer directory rows.
  - **Executive Trainer Profile Page ([id])**:
    - Integrated direct management actions inside the `trainer/[id]` toolbar:
      - `Edit Profile` (Pencil icon)
      - `Staff Portal` (Eye icon)
      - `Timetable Availability` toggle (`Enable / Disable Timetable`)
      - `Staff Status` toggle (`Activate / Deactivate`)
      - `Reset Password` (Password modal trigger)
      - `Link Account` (if ready to link)
    - Redesigned the page to be premium, executive, and high-density with significantly less text:
      - Compact avatar with initials, crisp identity line (Staff ID, Role, Department).
      - Streamlined status badges in a single row (`Active / Inactive`, `Timetable Available / Unavailable`, `Portal Status`).
      - Compact workload gauge with clean target bar and daily limit metric.
      - Clean 2-column layout for teaching allocations and staff credentials with zero wordiness.
  - **Cache Revalidation**:
    - Enhanced `revalidateTrainerPages` in `actions.ts` to revalidate `/trainers`, `/trainers/${id}`, and `/timetable/trainers/${id}` whenever availability or active status is toggled.
- **Verification Evidence**:
  - `npm test`: 117/117 test files passed, 585/585 tests passed.
  - `npm run check`: Typecheck, ESLint, and Next.js 16 production build passed with 0 errors across all 117 routes.

### 2026-09-14: Staff Workspace Access & Account Approvals Table Alignment Fix
- **Files Modified**:
  - `src/app/(dashboard)/trainers/page.tsx`
  - `src/app/(dashboard)/timetable/trainers/access/page.tsx`
- **What Changed**:
  - Replaced the ragged CSS grid layout with a semantic HTML `<table>` with explicit column headers (`Trainer`, `Workspace Details`, `Access Status`, `Actions`).
  - Fixed column width tracks (`w-[28%]`, `w-[32%]`, `w-[16%]`, `w-[24%]`) to ensure 100% straight vertical alignment down every column.
  - Eliminated redundant inline status spans (`Active` text) in the actions column, consolidating the account state into the dedicated **Access Status** column as a clear, uniform badge (`Active`, `Email Required`, `Ready to Link`, etc.).
  - Right-aligned all action buttons with uniform height (`h-8`) and borders (`Add Email`, `Password`, `Profile`) so they no longer shift or stagger horizontally.
  - Added horizontal scroll wrapper (`min-w-[760px]`) to maintain straight alignment on all screen sizes.
- **Verification Evidence**:
  - `npm run check`: Typecheck, ESLint, and Next.js 16 production build passed with 0 errors across all routes.

### 2026-09-14: Daily Report UI Polish & Frictionless Default-Present Attendance Architecture
- **Files Modified**:
  - `src/features/class-attendance/domain.ts`
  - `src/features/class-attendance/attendance-editor.tsx`
  - `src/features/trainer-daily-report/domain.ts`
  - `src/features/trainer-daily-report/trainer-form.tsx`
  - `src/app/(staff)/staff/daily-report/page.tsx`
  - `src/tests/class-attendance-domain.test.ts`
  - `src/tests/trainer-daily-report-domain.test.ts`
- **What Changed**:
  - **Frictionless Class Attendance Workflow**:
    - Purged the need for trainers to manually click "Present" 30–50 times per class session.
    - Defaulted active enrolled students to **Present** upon session opening (unless flagged as not reported for the semester).
    - Introduced high-density, single-click toggle between **Present** (emerald) and **Absent** (rose).
    - Added instant **Unavoidable Circumstance Chips** (`Leave of absence`, `Pending unit registration`, `Medical / Sickness`, `Official college duty`, `Fee clearance / Admin`) visible only when a student is marked Absent, pre-populating circumstances into notes with 1 click.
    - Added instant student search (by name or admission number) and filter tabs (`All`, `Absent`, `Present`, `Not Reported`).
    - Added "Reset All to Present" quick action button for instant reset.
  - **Executive Daily Report Interface & Wordiness Purge**:
    - Purged repetitive and wordy notices across `trainer-form.tsx` and `page.tsx`.
    - Consolidated overdue attendance into a concise, actionable alert banner.
    - Elevated scheduled lessons section with refined card layout, clean status badges (`Completed`, `In Progress`, `Not Recorded`, `Cancelled`), and metric pills with colored indicators.
    - Replaced wordy absentee descriptions with a streamlined **Absentee Register** displaying recognized circumstance tags.
    - Streamlined non-teaching day guidance and form inputs with character counters and concise microcopy.
    - Upgraded Daily Report page header with an executive date navigation stepper (`‹ Prev Day`, native date picker, `Next Day ›`, and `Today` quick jump shortcut).
- **Verification Evidence**:
  - `npx vitest run src/tests/class-attendance-domain.test.ts src/tests/trainer-daily-report-domain.test.ts`: 9/9 passed.
  - `npm test`: 117/117 test files passed, 585/585 tests passed.
  - `npm run check`: Typecheck, ESLint, and Next.js 16 production build passed with 0 errors across all routes.

### 2026-09-14: Zero-Hallucination Curriculum Hardening & Agricultural Production Fix
- **Files Modified**:
  - `src/features/teaching-documents/curriculum-data/shared-map.ts`
  - `src/features/teaching-documents/curriculum-data/index.ts`
  - `src/features/teaching-documents/curriculum-registry.ts`
  - `src/features/teaching-documents/curriculum-content/queries.ts`
  - `src/tests/curriculum-harmonization.test.ts`
- **What Changed**:
  - **Agricultural Production Isolation**:
    - Purged explicit erroneous alias mapping `"agriculturalproduction": "food_security"` and erroneous unit code mappings (`chn2309`, `dnd3205`, `cnd2306`).
    - Agricultural Production is an independent TVET unit whose syllabus is pending official document ingestion. It now cleanly displays `isAvailable: false`, empty schedule, and the clear "Curriculum Content Not Yet Available" notice without pulling in Food Security content.
  - **Comprehensive Purge of Synthetic / Loose Alias Associations**:
    - Purged all hallucinated title mappings: `"foodscience": "food_processing_preservation"`, `"demonstrationtechniques": "nutrition_education_counselling"`, `"communitydiagnosisandmobilization": "community_partnership_skills"`, `"nutritionforvulnerablegroups": "nutrition_assessment_surveillance"`, `"appliedbiologicalsciences": "physical_science"`, `"medicalterms": "human_anatomy_and_physiology"`, `"managementofmalnutrition": "diet_therapy_i"`, `"introductiontonutritioncareprocess": "diet_therapy_i"`, `"project": "trade_project"`.
    - Audited all 144 unit code mappings against the database `units` table to guarantee that only 100% verified codes matching the canonical curriculum remain.
  - **Abolition of Loose Bidirectional Substring Matching**:
    - Removed Priority 2 substring matching from `resolveCanonicalKey`.
    - Removed fuzzy bidirectional substring matching (`includes(searchName) || searchName.includes(...)`) from `findCanonicalCurriculum` and `getUnitCurriculum`. Resolution now strictly requires exact normalized string comparison.
  - **Semantic Title Compatibility Guardrail (`isCompatibleUnitTitle`)**:
    - Implemented and exported `isCompatibleUnitTitle` across `shared-map.ts`, `curriculum-data/index.ts`, `curriculum-registry.ts`, and `queries.ts`.
    - `resolveCanonicalKey` and `findCanonicalCurriculum` verify semantic compatibility before accepting any code-based match.
    - `enrichWithCanonical` strictly asserts title compatibility before injecting canonical schedules into allocation definitions; incompatible combinations immediately yield `isAvailable: false` with unpopulated schedules.
    - `isMismatchedPayload` prevents any cross-domain leaks between agriculture and food security payloads.
- **Verification Evidence**:
  - `npx vitest run src/tests/curriculum-harmonization.test.ts`: 16/16 tests passed (including new zero-hallucination regression suite).
  - `npx vitest run src/tests/tvet-teaching-documents.test.ts src/tests/teaching-documents-domain.test.ts src/tests/teaching-document-template-policy.test.ts src/tests/teaching-document-workflow.test.ts`: 24/24 tests passed.
  - `npm run check`:
    - `typecheck` (`next typegen && tsc --noEmit`): Passed with 0 errors.
    - `lint` (`eslint`): Passed with 0 errors.
    - `build` (`next build`): Passed with code 0 across all 117 pages and routes.

### 2026-09-14: Zero-Tolerance Curriculum Purge & Enterprise Unready-Content Architecture
- **Files Modified**:
  - `src/features/teaching-documents/curriculum-data/module-2.ts`
  - `src/features/teaching-documents/curriculum-data/types.ts`
  - `src/features/teaching-documents/curriculum-registry.ts`
  - `src/features/teaching-documents/curriculum-content/queries.ts`
  - `src/features/teaching-documents/distribution-engine.ts`
  - `src/features/teaching-documents/tvet-standards.ts`
  - `src/features/teaching-documents/tvet-document-viewer.tsx`
  - `src/features/teaching-documents/export-docx.ts`
  - `src/app/api/teaching-documents/export-word/route.ts`
  - `src/tests/curriculum-harmonization.test.ts`
  - `src/tests/curriculum-zip-ingestion.test.ts`
- **What Changed**:
  - **Complete Purge of Broken OCR & Synthetic Placeholders**:
    - Purged 100% of corrupted OCR text, placeholder titles (e.g., `"Principles of Food Processing and Preservation Core Topic 1"`), and garbled headers (`24206t6`, `fcxxis`, `mcxiern`) across all 12 units in Module 2.
    - Terminated synthetic topic generation in `distribution-engine.ts`: when syllabus content is not yet available (`N === 0`), the engine immediately returns an empty schedule `[]` instead of fabricating fake weeks (e.g. `"Instructional Module Week X"`).
  - **Explicit Availability Flagging & Informative User Messaging**:
    - Extended `UnitCurriculumDefinition`, `TVETCourseOutlineData`, and `TVETSchemeOfWorkData` with `isAvailable: boolean` and `notReadyMessage?: string`.
    - All pending/unverified units (such as Module 2 units prior to official DOCX ingestion) are explicitly marked `isAvailable: false` with clear institutional guidance.
  - **Document Viewer & Export Guardrails**:
    - `TVETDocumentViewer` renders a clear, prominent TVET alert banner informing trainers that syllabus ingestion is pending and broken/synthetic content was purged.
    - Disabled Word export for unready documents with clear user guidance in both the UI and the API endpoint (`/api/teaching-documents/export-word`).
    - Word export engine (`export-docx.ts`) renders an official Notice callout if an empty syllabus is processed, preventing empty or broken tables.
- **Verification Evidence**:
  - `npm test`: 117/117 test files passed, 577/577 tests passed.
  - `npm run check`: `typecheck` passed (0 errors), `lint` passed (0 errors), `next build` passed.

### 2026-09-13: Enterprise Generation of Modules 1 & 3 TVET Curriculum from Verbatim Source Extractions
- **Files Modified**:
  - `src/features/teaching-documents/curriculum-data/module-1.ts`
  - `src/features/teaching-documents/curriculum-data/module-3.ts`
- **What Changed**:
  - **Strict Single Source of Truth Enforcement (Zero Information Alteration)**:
    - Overhauled all 19 Module 1 units and all 12 Module 3 units directly from the user's extracted source documents (`Module_I_Curriculum.docx` and `Module_III_curriculum.docx`).
    - Enforced zero information alteration: no synthetic topics, no paraphrased learning objectives, and no omitted topics.
  - **Authentic Principles of Human Nutrition (20.1.0)**:
    - Replaced synthetic content with the authentic KNEC/KNDI syllabus:
      - Description and general objectives (a–e) preserved verbatim.
      - 11 official topics (*Introduction to Nutrition, Carbohydrates, Proteins, Lipids, Digestion, Absorption, Metabolism and Excretion of Nutrients, Energy, Water, Vitamins, Minerals, Malnutrition, Emerging Issues and Trends in Human Nutrition*).
      - Structured across the 14-week term with exactly 1 Mid-Term Continuous Assessment Test (CAT) at Week 8 (covering Weeks 1 to 7), strictly no CAT in Week 13 (dedicated to Comprehensive Syllabus Revision & Tutorial Clinic), and Final Summative Examination in Week 14.
  - **Pedagogical Bloom's Behavioral Learning Outcomes**:
    - Replaced passive subtopic noun phrases with active, measurable Bloom's taxonomy behavioral objectives (`Define`, `Classify`, `Explain`, `Describe`, `Identify`, `Analyze`, `Calculate`, `Evaluate`, `Demonstrate`, `Discuss`).
    - Standardized with authoritative TVET preamble: `"By the end of the lesson/topic, the trainee should be able to:\n"`.
  - **Module 3 Sub-Module Unit Coding Integrity**:
    - Rebuilt all 12 units with clean 5-digit sub-module unit coding (`34.3.01` through `45.3.06`).
    - Purged 100% of historical OCR artifacts (`aff<`, `frxh3`, `im1Y)rtance`, `focd`, `diffazt`).
- **Verification Evidence**:
  - `npx vitest run src/tests/curriculum-harmonization.test.ts src/tests/tvet-teaching-documents.test.ts`: 20/20 tests passed.
  - `scripts/verify_curriculum_integrity.py`: 0 OCR artifacts found across both module files.
  - `npm run typecheck`: `next typegen && tsc --noEmit` passed (0 errors).

### 2026-09-13: TVET Curriculum Harmonization & Phase 1 Quality Cleansing
- **Files Added/Modified**:
  - `src/features/teaching-documents/curriculum-data/module-1.ts`
  - `src/features/teaching-documents/curriculum-data/shared-map.ts`
  - `src/features/teaching-documents/curriculum-content/queries.ts`
  - `supabase/migrations/20260913160000_deactivate_corrupted_curriculum_versions.sql` (NEW)
- **What Changed**:
  - **Overhauled Canonical Module 1 Units (`module-1.ts`)**:
    - Cleansed and structured all 19 canonical curriculum units across Nutrition, Dietetics, and Core Common Units.
    - Completely purged OCR corruption artifacts (e.g. `crnail`, `(Fating system`, `O'cd) (15vd)`), misallocated outlines (e.g. Biochemistry content under Nutrition Epidemiology), and Table of Contents bleed.
    - Each unit now includes authoritative TVET unit descriptions, Bloom's revised taxonomy competencies, 4–6 discrete learning outcomes, 14-week structured syllabi (`• ...` specific learning outcomes, student-centered learning activities, instructional resources, and TVET assessment milestones: CAT 1 in Week 6/7, Mid-Term CAT 2 in Week 9, Revision in Week 13, and Final Examination in Week 14), standard textbooks, and lab/instructional equipment.
  - **Disambiguated Unit Mappings & Title-First Resolution (`shared-map.ts`)**:
    - Expanded registry with 306 mappings across all institutional acronyms, codes, and title variants.
    - Updated `resolveCanonicalKey` to prioritize exact normalized unit title matching before course code matching. This resolves inter-departmental code collisions where different courses share identical numbers (e.g. CCU 1106 ICT no longer collides with Life Skills; CCU 1103 HIV no longer collides with Nutrition).
    - Verified against all 59 currently active teaching allocations in the institution with zero unmapped units or fallback errors.
  - **Database Migration & Corrupted Version Patch**:
    - Created migration `20260913160000_deactivate_corrupted_curriculum_versions.sql` and superseded historical corrupted rows in `curriculum_document_versions` in Supabase (deactivating `7d1e41bb-b2bc-4cce-84f2-3176856bb58b` and `253edeaf-5785-4f01-88d4-5c12df7a160e`).
  - **Trainer Portal Content Guardrails (`queries.ts`)**:
    - Added automated corruption detection (`isCorruptedText`) and mismatched payload validation (`isMismatchedPayload`) to the curriculum query pipeline.
    - Any legacy or corrupted DB record is automatically rejected at runtime, falling back smoothly to the verified canonical syllabus data.
- **Verification Evidence**:
  - `npx vitest run src/tests/curriculum-harmonization.test.ts`: 8/8 tests passed.
  - `npx vitest run src/tests/tvet-teaching-documents.test.ts`: 12/12 tests passed.
  - `verify_all_active_units.py`: Verified 59 out of 59 active institutional teaching allocations resolve cleanly with 0 OCR errors.
  - `npm run check`: TypeScript strict check, ESLint, and Next.js 16 production build succeeded (Exit code 0).

### 2026-09-13: Replaced Print Function with Direct PDF Download Function
- **Files Added/Modified**:
  - `src/features/assessment/attendance-sheet-pdf.tsx` (NEW)
  - `src/tests/attendance-sheet-pdf.test.ts` (NEW)
  - `src/app/api/staff/units/[allocationId]/attendance-sheet/[type]/route.ts`
  - `src/features/class-attendance/printable-class-register.tsx`
  - `src/features/assessment/printable-signing-sheet.tsx`
- **What Changed**:
  - **Replaced `window.print()` with Native PDF File Download**:
    - Replaced the browser print dialog trigger (`onClick={() => window.print()}`) with a direct file download link (`<a href="...?format=pdf" download>`) across `printable-class-register.tsx` and `printable-signing-sheet.tsx`.
    - Clicking "Download PDF" now immediately downloads the official, pre-rendered PDF document directly to the user's computer.
  - **Implemented Institutional PDF Generator (`attendance-sheet-pdf.tsx`)**:
    - Built with `@react-pdf/renderer` supporting both Landscape (for Class Attendance) and Portrait (for CAT / Exam Attendance).
    - Features full institutional branding: centered college logo (`icmhs-logo.png`), institution title, academic period, department and unit metadata.
    - Separate A4 page per cohort for multi-cohort shared units, maintaining CDACC/TVET audit compliance.
    - Sequential numbering (1 to N) per cohort plus 4 blank candidate entry rows.
    - Full-width landscape sign-off section with pre-filled trainer name, wide comment underlines, and clean signature lines with zero box borders.
  - **Integrated PDF Endpoint in Attendance Sheet API Route**:
    - Updated `/api/staff/units/[allocationId]/attendance-sheet/[type]` to accept `?format=pdf`.
    - Generates and streams the PDF document with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="... Attendance Sheet.pdf"`.
- **Verification Evidence**:
  - `npm test -- src/tests/attendance-sheet-pdf.test.ts`: 3/3 tests passed (CAT, Multi-Cohort Exam, and Landscape Class PDF generation).
  - `npm test -- src/tests/attendance-sheet-docx.test.ts`: 3/3 tests passed.
  - `npm run check`: TypeScript typecheck, ESLint, and Next.js 16 production build succeeded (Exit code 0).

### 2026-09-13: Word Docx Borderless Sign-off, Wrap Prevention & "Download PDF" Renaming
- **Files Modified**:
  - `src/features/assessment/attendance-sheet-docx.ts`
  - `src/features/class-attendance/printable-class-register.tsx`
  - `src/features/assessment/printable-signing-sheet.tsx`
  - `src/components/ui/print-action-button.tsx`
  - `src/tests/attendance-sheet-docx.test.ts`
- **What Changed**:
  - **Removed Word Table Box Borders**:
    - Set `borders: TableBorders.NONE` on `new Table(...)` for both class and exam sign-off sections, eliminating default outer and inner grid borders in Microsoft Word.
    - Preserved crisp bottom underline borders (`w:bottom w:val="single"`) exclusively on the handwriting/signing fields.
  - **Prevented Text Wrapping in Word (`Comme\nnt:`)**:
    - Expanded column widths in landscape Word sign-off table to `[2800, 2600, 1500, 6000, 900, 1600]` dxa:
      - Column 2 ("Comment:"): Expanded from `1100` to `1500` dxa, providing double the required width for the 8-character string.
      - Column 0 ("Class Representative:"): Expanded to `2800` dxa.
      - Column 4 ("Sign:"): Expanded to `900` dxa.
    - Added `keepLines: true` to paragraph formatting in `signoffLabelCell` to prevent Word from splitting lines.
    - Applied non-breaking spaces (`\u00A0`) in multi-word labels (`Class\u00A0Representative:`, `Exam\u00A0Officer:`) and `whitespace-nowrap` on all web preview labels.
  - **Renamed "Print / Save PDF" to "Download PDF"**:
    - Updated web action buttons in `printable-class-register.tsx`, `printable-signing-sheet.tsx`, and the reusable `PrintActionButton` component to display "Download PDF" with `<Download />` icons.
- **Verification Evidence**:
  - `npm test -- src/tests/attendance-sheet-docx.test.ts`: Passed (verified `TableBorders.NONE`, `keepLines`, and underline borders).
  - `npm run check`: TypeScript typecheck, ESLint, and Next.js 16 production build succeeded (Exit code 0).

### 2026-09-13: Full-Width & Well-Spaced Landscape Sign-off Section (Web & Word .docx)
- **Files Modified**:
  - `src/features/class-attendance/printable-class-register.tsx`
  - `src/features/assessment/printable-signing-sheet.tsx`
  - `src/features/assessment/attendance-sheet-docx.ts`
  - `src/app/api/staff/units/[allocationId]/attendance-sheet/[type]/route.ts`
  - `src/components/staff/staff-shell.tsx`
  - `src/tests/attendance-sheet-docx.test.ts`
- **What Changed**:
  - **Word (.docx) Landscape Orientation & Exact Table Layout Matching Web Preview**:
    - Addressed user feedback where downloaded Word documents did not retain the landscape layout, full-width alignment, and sign-off formatting seen in the web preview (`media_1789279315395.png`).
    - Configured `PageOrientation.LANDSCAPE` with dimensions `16838 x 11906` dxa and standard `720` dxa margins for class attendance sheets in Word.
    - Updated the main attendance register table columns to span the exact `15400` dxa usable width (`[700, 2600, 4500, ...Array(8).fill(950)]`).
    - Replaced plain text underscore paragraphs with an official Word `Table` (`width: 100%`, `columnWidths: [2400, 3200, 1100, 5900, 800, 2000]`) with borderless cells and crisp bottom borders on input lines.
    - Added `trainerName` to the API route payload so the Trainer row in Word displays the trainer name (e.g. `Wilfred Osozi`) directly on the underline, matching the web preview.
    - Also converted Exam/CAT attendance sheet sign-offs to full-width structured tables in Word.
  - **Full-Width Landscape Alignment in Browser & Print**:
    - Unified the register table and sign-off block inside a shared `min-w-[900px] w-full` container so the sign-off block spans 100% of the table's width, from the leftmost `No.` column to the rightmost session column, with zero right-side blank space.
    - Updated the grid to use proportional `fr` units (`grid-cols-[150px_1.2fr_70px_2.5fr_45px_1fr]`):
      - Role & Name: `150px` label + `1.2fr` underline. Pre-fills `trainerName` when available.
      - Comment: `70px` label + `2.5fr` wide underline for detailed observation remarks.
      - Sign: `45px` label + `1fr` underline extending directly to the outer right edge.
  - **Generous Vertical Spacing**:
    - Increased vertical gap to `gap-y-5` with `h-5` underlines for comfortable handwriting and signing clearance.
  - **Print Layout & Portal Shell Fixes**:
    - Added `@page { size: A4 landscape; margin: 8mm 10mm; }` so browser print dialog automatically defaults to Landscape.
    - In `staff-shell.tsx`, added `print:hidden` to the sidebar, top header, and mobile navigation bar, and removed `lg:pl-[var(--sidebar-width)]` and `max-w-[var(--content-max-width)]` in print mode (`@media print`) so printed landscape documents occupy 100% of the page width without clipping or displacement.
- **Verification Evidence**:
  - `npm test`: 116 test files passed, 572 tests passed.
  - `npm run check`: TypeScript typecheck, ESLint, and Next.js 16 production build succeeded (Exit code 0).

### 2026-09-13: Dedicated Multi-Cohort Separate Lists for Shared Classes
- **Files Modified/Added**:
  - `src/features/academic-roster/unified-roster.ts`
  - `src/features/assessment/population-workspace.ts`
  - `src/features/class-attendance/printable-class-register.tsx`
  - `src/features/assessment/printable-signing-sheet.tsx`
  - `src/features/assessment/attendance-sheet-docx.ts`
  - `src/app/(staff)/staff/units/[allocationId]/documents/class-attendance/page.tsx`
  - `src/app/(staff)/staff/units/[allocationId]/documents/cat-attendance/page.tsx`
  - `src/app/(staff)/staff/units/[allocationId]/documents/exam-attendance/page.tsx`
  - `src/app/api/staff/units/[allocationId]/attendance-sheet/[type]/route.ts`
  - `src/tests/attendance-sheet-docx.test.ts`
- **What Changed**:
  - **Separate Cohort Organization for Shared Classes**:
    - Addressed user requirement to provide separate, dedicated lists per cohort (e.g. CND SEPT 26 separate from DND SEPT 26) instead of intermingling them, meeting TVET accreditation, external examination (KNEC/CDACC), and departmental filing standards.
    - Added cohort tracking metadata (`cohortId`, `cohortName`) through `AssessmentPopulationStudent` and roster data models.
  - **Interactive Cohort Switcher & Dedicated Print Layouts**:
    - `PrintableClassRegister`:
      - Added interactive cohort tabs (`All Cohorts`, `CND SEPT 26`, `DND SEPT 26`) to toggle the preview in the browser.
      - Automatically groups students by cohort in alphabetical cohort order (e.g. Certificate first, Diploma next).
      - Numbers students sequentially starting from 1 for each cohort register (`1..N`).
      - Appends dedicated blank rows (4 rows) and sign-off blocks per cohort.
      - Configured CSS print page breaks (`break-after: page`) between cohort registers so each cohort automatically prints onto clean, separate A4 pages.
    - `PrintableSigningSheet` (CAT & Exam):
      - Added interactive cohort tabs with badge counts.
      - Renders dedicated signing sheets per cohort with sequential numbering (1 to N), 4 blank signing rows per cohort, and individual certification summaries.
      - Separates printed cohort lists with page breaks.
  - **Multi-Cohort Word (.docx) Export**:
    - Upgraded `generateAttendanceSheetDocx` to group candidates by cohort.
    - When multiple cohorts exist, it now creates a dedicated Word document `section` per cohort, automatically generating clean page breaks, per-cohort headers, 1..N sequential numbering, and official institutional sign-off footers.
  - **Verification Evidence**:
    - Added automated unit test in `src/tests/attendance-sheet-docx.test.ts` verifying multi-cohort document generation.
    - `npm test`: 116 test files passed, 571 tests passed (Exit code 0).
    - `npm run check`: TypeScript typecheck, ESLint, and Next.js 16 production build succeeded (Exit code 0).

### 2026-09-13: Shared Class Attendance Roster Integration & Equivalent Units
- **Files Modified/Added**:
  - `src/features/academic-roster/unified-roster.ts`
  - `src/tests/unified-unit-roster.test.ts`
  - `supabase/migrations/20260913043000_shared_class_attendance_roster.sql`
- **What Changed**:
  - **Shared Class Equivalent Unit Roster Discovery**:
    - Identified that in shared classes (such as `CND SEPT 26` sharing timetable slots with `DND SEPT 26`), students are registered under their programme-specific unit codes (e.g. `CND 1104` vs `DND 1104`), while teaching allocations and timetable slots are tied to a single primary unit ID.
    - Previously, both `getUnifiedUnitRoster` and the PostgreSQL `open_class_attendance_session` RPC filtered strictly by `reg.unit_id = unitId`, omitting all students registered under the equivalent units of the shared class.
    - Enhanced `getUnifiedUnitRoster` to discover all equivalent unit IDs via:
      1. `teaching_allocations.teaching_offering_id`
      2. `unit_offerings.confirmed_shared_offering_id`
      3. Participating cohorts with matching canonical unit titles via `canonicalizeSharedUnitTitle`.
    - Updated query to fetch `student_unit_registrations` with `.in('unit_id', allUnitIds)` for active registered students (`registration_status = 'registered'`).
    - Added all participant and related unit cohorts into `allCohortIds` so header displays show joined cohort names (e.g. `CND SEPT 26 / DND SEPT 26`).
  - **PostgreSQL Database Migration**:
    - Created migration `20260913043000_shared_class_attendance_roster.sql` upgrading `open_class_attendance_session` to dynamically discover related shared units and seed `class_attendance_entries` across all equivalent units while preserving strict unit registration enforcement (unregistered cohort members like Francis Maina remain strictly excluded).
    - Added one-time sync updating active `class_sessions` and synchronizing `roster_count`.
    - Pushed migration to remote Supabase database (`npx supabase db push --yes`).
  - **Automated Tests**:
    - Added test in `unified-unit-roster.test.ts` verifying that when a shared class has multiple equivalent units, registered students from both cohorts are included and unregistered cohort members are excluded.
- **Verification Evidence**:
  - Live database test verified that all 23 students from `CND SEPT 26` are present on all 6 shared allocations:
    - `DND 1106`: 39 students (15 DND SEPT 26 + 1 DND SEPT 25 + 23 CND SEPT 26)
    - `DND 1105`: 60 students (15 DND SEPT 26 + 23 CND SEPT 26 + 21 CND SEPT 25 + 1 DND SEPT 25)
    - `DND 1103`: 40 students (15 DND SEPT 26 + 23 CND SEPT 26 + 2 DND retakers)
    - `CND 1101`: 39 students (23 CND SEPT 26 + 15 DND SEPT 26 + 1 DND SEPT 25)
    - `DND 1104`: 39 students (15 DND SEPT 26 + 23 CND SEPT 26 + 1 CND SEPT 25)
    - `CND 1102`: 39 students (23 CND SEPT 26 + 15 DND SEPT 26 + 1 DND SEPT 25)
  - `npm test`: 116 test files passed, 570 tests passed (Exit code 0).
  - `npm run check`: TypeScript typecheck (0 errors), ESLint (0 errors), Next.js production build succeeded (Exit code 0).
  - `npx supabase db push --dry-run` confirms remote database is completely up to date.

### 2026-09-13: PostgREST 1,000-Row Truncation Fix in Unit Registration & Reporting
- **Files Modified**:
  - `src/features/student-unit-registration/queries.ts`
  - `src/features/student-unit-registration/student-unit-registration-table.tsx`
  - `src/features/reporting/queries.ts`
  - `supabase/migrations/20260912204500_purge_draft_teaching_allocations.sql`
  - `supabase/migrations/20260913033000_bind_cnd_1105_to_y1s1_and_register_sept26.sql`
- **What Changed**:
  - **Supabase / PostgREST 1,000-Row Truncation Root Cause Resolution**:
    - Identified that `getUnitRegistrationContext` and `getDepartmentAcademicReportingDashboard` fetched `student_unit_registrations` without range pagination.
    - With 1,214 registrations active in `September-December 2026`, PostgREST silently capped the query response at 1,000 rows. Students falling towards the end of the alphabetical roster (such as `AKOI, VINCENT MUKOYA`, `CND/S-8171/IC/26`) had 5 of their 6 registered units cut off, resulting in the UI incorrectly displaying `1 / 6 units assigned` and status `Pending`.
    - Implemented chunked `.range(from, from + PAGE_SIZE - 1)` loop fetching across all 1,214+ registration rows in `queries.ts` and `reporting/queries.ts`.
    - Vincent Akoi and all 23 students in `CND SEPT 26` now accurately reflect **6 / 6 units assigned**.
  - **Registered & Partial Status Badging**:
    - In `student-unit-registration-table.tsx`: added direct check in `statusBadge` to render `<Badge variant="success">Registered</Badge>` when a student has all expected units assigned (`selectedUnits >= expectedUnits`), and `<Badge variant="warning">Partial (X/Y)</Badge>` when partially assigned.
    - Updated table status dropdown filter to support filtering by `Registered`.
  - **Remote Migration Bugfixes**:
    - Fixed `20260912204500_purge_draft_teaching_allocations.sql`: replaced non-existent `timetable_slots` with `class_sessions` and `scheduled_sessions`.
    - Fixed `20260913033000_bind_cnd_1105_to_y1s1_and_register_sept26.sql`: corrected enum filtering to valid `student_lifecycle_status` values (`'admitted'`, `'active'`) and column name to `created_by`.
    - Successfully pushed all migrations to remote Supabase (`npx supabase db push --yes`).
- **Verification Evidence**:
  - `npm test`: 116 test files passed, 569 tests passed (Exit code 0).
  - `npm run check`: TypeScript typecheck (0 errors), ESLint (0 errors), Next.js production build succeeded (Exit code 0).
  - Dry run `npx supabase db push --dry-run` confirms remote database is completely up to date.

### 2026-09-13: CND 1105 Y1S1 Stage Alignment & CND SEPT 26 Unit Registration
- **Files Added**:
  - `supabase/migrations/20260913033000_bind_cnd_1105_to_y1s1_and_register_sept26.sql`
- **What Changed**:
  - **CND 1105 Curriculum Stage Alignment**:
    - Realigned `CND 1105: Human Anatomy and Physiology` from `Y2S1` (where it had been erroneously placed with `academic_period_number = 4`) to `Y1S1` (`Year 1 Semester 1`) with `academic_period_number = 1`.
    - In `programme_stage_units`: deleted the erroneous binding of `CND 1105` to `Y2S1` and bound it to `Y1S1` (`7b8c78d5-cae7-496a-a09e-7fd15cffdd1a`).
    - CND Year 1 Semester 1 now correctly provides all 6 expected curriculum units: `CND 1101`, `CND 1102`, `CND 1103`, `CND 1104`, `CND 1105`, and `CND 1106`.
  - **Cohort Unit Registration**:
    - Registered `CND 1105` for all 23 active students in `CND-SEP-2026` (`CND SEPT 26`) for active academic period `September-December 2026`.
    - `CND SEPT 26` now has 138 total active unit registrations (6 units x 23 students).
- **Verification Evidence**:
  - `npm test`: 116 test files passed, 569 tests passed (Exit code 0).
  - `npm run check`: TypeScript typecheck (0 errors), ESLint (0 errors), Next.js production build succeeded (Exit code 0).
  - Database status: `CND-SEP-2026` has 6 stage units and 138 registered unit records.

### 2026-09-13: Unit Registration Pipeline & September 2026 Intake Resolution
- **Files Added**:
  - `supabase/migrations/20260913030000_fix_unit_registration_pipeline_and_sept26_stages.sql`
- **Files Modified**:
  - `src/features/student-unit-registration/batch-queries.ts`
  - `src/features/student-unit-registration/queries.ts`
  - `src/features/student-unit-registration/cohort-stage-actions.ts`
  - `src/features/student-unit-registration/cohort-stage-assignment.tsx`
  - `src/features/student-unit-registration/batch-unit-registration.tsx`
  - `src/app/(dashboard)/students/unit-registration/batch/page.tsx`
- **What Changed**:
  - **September 2026 Intake Cohort Stage Assignment & Unit Registration**:
    - Identified that `DNDT-SEP-2026 (DNDT SEPT 26)` had `current_stage_id = null`, and its enrolled students had `current_stage_id = null`.
    - Assigned stage `Y1S1` (`356a135b-a1ae-48ae-b630-fdbd5106af6a`) to cohort `DNDT-SEP-2026` and its students in database migration `20260913030000_fix_unit_registration_pipeline_and_sept26_stages.sql`.
    - Automatically registered all 14 expected units (7 curriculum units per student) for `DNDT SEPT 26` under active academic period `2f94652a-1c40-4359-bd1b-21f25f92d2bf` (`September-December 2026`).
    - Verified all September 2026 intake cohorts:
      - `CND SEPT 26`: 23 students, 115 registered units (Y1S1).
      - `DND SEPT 26`: 15 students, 90 registered units (Y1S1).
      - `DNDT SEPT 26`: 2 students, 14 registered units (Y1S1).
  - **Cohort Stage Fallback in Unit Registration Pipeline**:
    - Updated `batch-queries.ts` to join `cohorts.current_stage_id` and compute `effectiveStageId = student.current_stage_id || studentCohort?.current_stage_id || null`. Students without an individual stage override now correctly inherit their cohort's stage rather than being rejected with `eligibilityReason: 'no_stage'`.
    - Updated `queries.ts` (`getDepartmentRegistrationEditor`) to similarly evaluate `effectiveStageId = student.current_stage_id || cohort?.current_stage_id || null`.
    - Updated `batch_register_expected_student_units` RPC in PostgreSQL migration to select `coalesce(s.current_stage_id, c.current_stage_id)`.
  - **Error Handling & Cryptic Messaging Overhaul**:
    - Overhauled `batch-unit-registration.tsx` error decoding: replaced raw message string dumps like `"Registration was not completed. students"` with clear, actionable user guidance:
      - `students` -> "No students were selected for registration. Please select at least one student before submitting."
      - `cohort` -> "Cohort not found or invalid. Please select a valid cohort."
      - `period` -> "Active academic period not found. Please verify the academic calendar configuration."
      - `failed` / generic -> "Unable to complete batch registration. Please verify student stage assignments and unit offerings."
    - Enhanced `CohortStageAssignment` in `cohort-stage-actions.ts`: wrapped stage assignment in a robust try/catch block with explicit Server Action redirect passing `?stage_updated=1&cohortId=...`.
    - Added emerald confirmation banner on batch registration page upon cohort stage updates (`"Cohort stage updated to [Stage]. Eligible students are ready for registration."`), automatically selecting eligible students so the HOD can proceed with one click.
    - Added an empty-state stage setup prompt inside the batch form when a cohort has no stage assigned, preventing user confusion.
- **Verification Evidence**:
  - `npm test`: 116 test files passed, 569 tests passed (Exit code 0).
  - `npm run check`: TypeScript typecheck (0 errors), ESLint (0 errors), Next.js production build succeeded (Exit code 0).

### 2026-09-12: Premium Executive Redesign & Draft Purge for Trainer Details Page (`/trainers/[id]`)
- **Files Added**:
  - `supabase/migrations/20260912204500_purge_draft_teaching_allocations.sql`
- **Files Modified**:
  - `src/features/trainers/queries.ts`
  - `src/app/(dashboard)/trainers/[id]/page.tsx`
- **What Changed**:
  - **Premium Executive UI Redesign**:
    - Completely redesigned `src/app/(dashboard)/trainers/[id]/page.tsx` with a minimal, unified layout eliminating repetitive components and scattered actions.
    - **Unified Header Action Toolbar**: Placed a single navigation backlink and consolidated buttons (`View Staff Portal` in institutional `#033B36`, `Reset Password`, `Edit Profile`, `Availability`, and `TrainerAccessAction` when pending). Eliminated all duplicate portal buttons and redundant edit links.
    - **Hero Identity Card**: Features an initials avatar badge, staff number, workload role, department, and a single status chip row (`Active Staff`, `Portal Linked`, `Availability Mode`). Removed duplicate green banners and repetitive status telemetry boxes.
    - **Integrated Workload Progress Gauge**: Direct real-time progress bar showing `{totalAllocatedHours} / {targetHours} hrs/wk`, utilization percentage, and daily caps in a compact widget.
    - **Clean Two-Column Split**:
      - **Approved Teaching Allocations (Left, col-span-8)**: Clean table cards with unit code badges, cohort names, class sizes, session durations, and `Timetable Approved` badges with a direct `+ Assign Unit` action.
      - **Contact & Credentials (Right, col-span-4)**: Unified card grouping Email, Phone, Employment Type, Specialization, Qualifications, and optional Administrative Notes.
  - **Trainer Allocations Query Filtering**:
    - Updated `getTrainerAllocations` in `src/features/trainers/queries.ts` to strictly filter by `.eq('is_timetable_enabled', true).eq('status', 'active')`.
    - Eliminated obsolete draft/archived teaching allocation records (e.g. 2029 test records and disabled imports) that were previously bloating trainer workload statistics and displaying with "Draft" badges on the trainer profile.
  - **Database Cleanup Migration**:
    - Purged unreferenced draft and archived `teaching_allocations` across all trainers.
    - Added versioned SQL migration `20260912204500_purge_draft_teaching_allocations.sql`.
- **Verification Evidence**:
  - `npm test`: 116 test files passed, 569 tests passed (Exit code 0).
  - `npm run check`: TypeScript typecheck (0 errors), ESLint (0 errors), Next.js production build succeeded (Exit code 0).

### 2026-09-12: Strict Unit Registration Roster Enforcement (Exclusion of Unregistered Cohort Members)
- **Files Added**:
  - `supabase/migrations/20260912193000_strict_unit_registration_roster.sql`
- **Files Modified**:
  - `supabase/migrations/20260911070000_semester_program_of_activities.sql`
  - `src/features/academic-roster/unified-roster.ts`
  - `src/features/class-attendance/queries.ts`
  - `src/app/api/staff/attendance/sessions/route.ts`
  - `src/tests/unified-unit-roster.test.ts`
- **What Changed**:
  - **Migration Enum Cast Fix**:
    - Fixed `20260911070000_semester_program_of_activities.sql` RLS manage policy where `p.role in ('admin', 'hod', 'dean', 'principal')` was failing with PostgreSQL `ERROR: invalid input value for enum app_role: "admin"` during `supabase db push`. Updated to `p.role::text in ('system_admin', 'admin', 'hod', 'dean', 'principal')` to support all management roles and adhere to `public.app_role` enum values (`'system_admin'`, `'hod'`).
  - **Authoritative Source of Truth (Unit Registrations Only)**:
    - Academic registers (Class Attendance, CAT Attendance, Exam Attendance sheets, Markbooks, and Daily Report absentees) now strictly reference verified unit registrations from `student_unit_registrations` (`registration_status = 'registered'`).
    - Removed the cohort-wide active student fallback in `getUnifiedUnitRoster` that incorrectly added unregistered students (such as Francis Maina in DHN MAY 24 appearing on DHN 3203 Epidemiology) simply because their cohort shared the room or timetable session.
    - Participating cohorts are still discovered to accurately render combined header titles (e.g. `Cohort: CHN JAN/MAR 25 / CHN MAY 25`), but the student list is strictly confined to students registered for that unit.
  - **Orphan Entry Purging**:
    - Enhanced `getClassAttendanceWorkspace` and `POST /api/staff/attendance/sessions` to detect and immediately purge any orphaned `class_attendance_entries` where the student is not registered for that unit.
    - Updated `open_class_attendance_session` database function to insert exclusively from `student_unit_registrations` and delete any legacy non-registered student entries.
    - Provided one-time migration cleanup query synchronizing all session `roster_count` values.
- **Verification Evidence**:
  - `npm test`: 116 test files passed, 569 tests passed (Exit code 0).
  - `npm run check`: TypeScript typecheck (0 errors), ESLint (0 errors), Next.js production build succeeded (Exit code 0).

### 2026-09-12: Daily Report Attendance-First Overhaul, Past Attendance Enforcement & Unreported Students Solution
- **Files Added**:
  - `supabase/migrations/20260912190000_attendance_not_reported_and_daily_report_v2.sql`
  - `src/app/api/staff/attendance/sessions/exception/route.ts`
- **Files Modified**:
  - `src/features/academic-roster/unified-roster.ts`
  - `src/features/class-attendance/types.ts`
  - `src/features/class-attendance/domain.ts`
  - `src/features/class-attendance/queries.ts`
  - `src/features/class-attendance/attendance-editor.tsx`
  - `src/app/(staff)/staff/attendance/[sessionId]/page.tsx`
  - `src/app/api/staff/attendance/sessions/route.ts`
  - `src/features/trainer-daily-report/types.ts`
  - `src/features/trainer-daily-report/queries.ts`
  - `src/features/trainer-daily-report/trainer-form.tsx`
  - `src/tests/class-attendance-domain.test.ts`
  - `src/tests/operations-attendance-oversight.test.ts`
- **What Changed**:
  - **Daily Report Attendance-First Workflow**:
    - Embedded prominent direct **"Record Attendance"** CTA buttons on each scheduled lesson card in `TrainerDailyReportForm`.
    - Integrated automatic session creation and smooth return-to-report navigation (`returnTo=/staff/daily-report?date=...`) upon register completion.
    - Added comprehensive **Class Attendance Summary Table** displaying scheduled times, units, cohorts, total enrolled, present, absent, not reported, and status.
    - Added dedicated **Absentees Breakdown Table** detailing student names, admission numbers, cohorts, and reasons.
  - **Un-Reported Students Solution (`not_reported`)**:
    - Expanded `class_attendance_entries.attendance_status` to include `'not_reported'`.
    - Integrated `student_period_reporting` across `getUnifiedUnitRoster`, `open_class_attendance_session`, and `getClassAttendanceWorkspace` to auto-tag students with unconfirmed reporting status as `'not_reported'`.
    - Prevented un-reported students from being counted as absent or appearing in absentees lists, while enabling trainers to still mark them `Present` if they attend class in person without blocking completion.
  - **Graceful Past Unrecorded Attendance Enforcement**:
    - Implemented `detectPastUnrecordedSessions` to identify past timetable sessions in the active term lacking attendance records.
    - Added **Unrecorded Past Classes Banner** alerting trainers to overdue sessions (>48h).
    - Added **"Class Did Not Take Place" Exception Dialog** and API endpoint (`api/staff/attendance/sessions/exception`), allowing trainers to log auditable reasons (public holidays, college events, rescheduled classes, official leave) so compliance is enforced without trapping trainers or forcing artificial registers.
- **Verification Evidence**:
  - `npm test`: 116 test files passed, 569 tests passed (Exit code 0).
  - `npm run check`: TypeScript typecheck (0 errors), ESLint (0 errors), Next.js 16 production build succeeded (Exit code 0).

### 2026-09-12: Concise Cohort Short Names Display on Printable Attendance Sheets & Word Exports
- **Files Modified**:
  - `src/features/assessment/printable-signing-sheet.tsx`
  - `src/features/class-attendance/printable-class-register.tsx`
  - `src/features/assessment/attendance-sheet-docx.ts`
- **What Changed**:
  - Replaced concatenated multi-programme full titles (e.g. `Certificate in Human Nutrition and Dietetics / Certificate in Nutrition and Dietetics / Diploma in Nutrition and Dietetics (CHN JAN/MAR 25 / CHN MAY 25 / CND JAN/MAR 26 / DND JAN/MAR 26)`) with concise cohort short names: `Cohort: CHN JAN/MAR 25 / CHN MAY 25 / CND JAN/MAR 26 / DND JAN/MAR 26` across printable Class Attendance, CAT Attendance, Exam Attendance sheets, and Word (.docx) exports.
- **Verification Evidence**:
  - `npm test`: 116 test files passed, 569 tests passed.
  - `npm run check`: TypeScript typecheck (0 errors), ESLint (0 errors), Next.js 16 production build succeeded (Exit code 0).

### 2026-09-12: Unified Multi-Cohort Student Rosters Across Class Attendance, CAT, Exam, and Daily Reports
- **Files Added**:
  - `src/features/academic-roster/unified-roster.ts`
  - `supabase/migrations/20260912180000_unified_unit_attendance_roster.sql`
  - `src/tests/unified-unit-roster.test.ts`
- **Files Modified**:
  - `src/features/assessment/population-workspace.ts`
  - `src/features/assessment/attendance-sheet-data.ts`
  - `src/features/assessment/attendance-sheet-docx.ts`
  - `src/app/api/staff/units/[allocationId]/attendance-sheet/[type]/route.ts`
  - `src/app/(staff)/staff/units/[allocationId]/documents/cat-attendance/page.tsx`
  - `src/app/(staff)/staff/units/[allocationId]/documents/exam-attendance/page.tsx`
  - `src/app/(staff)/staff/units/[allocationId]/documents/class-attendance/page.tsx`
  - `src/app/api/staff/attendance/sessions/route.ts`
  - `src/features/class-attendance/queries.ts`
  - `src/features/trainer-daily-report/queries.ts`
- **What Changed**:
  - **Unified Unit Roster Helper (`getUnifiedUnitRoster`)**: Created authoritative server helper that discovers all cohorts offering or taking a unit in an academic period (from `unit_offerings`, `teaching_allocations`, and `student_unit_registrations`) and builds the complete union of students (both explicit unit registrations and enrolled active cohort members), deduplicated by `student_id` and naturally sorted by admission number.
  - **Assessment & Population Workspaces**: Refactored `getAllocationPopulationWorkspace` and `getAssessmentPopulationWorkspace` to use `getUnifiedUnitRoster`, returning multi-cohort header names (e.g. `CHN MAY 25 / CHN JAN/MAR 25`) and full candidate rosters.
  - **CAT & Exam Attendance Sheets**: Updated printable signing sheets and Word (.docx) export route to display the combined multi-cohort label and full candidate population.
  - **Class Attendance Register & Interactive Workspace**: Refactored `getClassAttendanceWorkspace` and `sessions/route.ts` to automatically seed all candidates across all offering cohorts into `class_attendance_entries` while preserving previously marked states (`present`, `absent`, notes).
  - **Trainer Daily Reports**: Updated `getTrainerDailyReportWorkspace` and `_trainer_daily_schedule_v1` to display combined multi-cohort titles and accurate live attendance roster/present/absent metrics.
  - **Database Migration**: Created `20260912180000_unified_unit_attendance_roster.sql` upgrading `open_class_attendance_session` and `_trainer_daily_schedule_v1` with multi-cohort resolution.
- **Verification Evidence**:
  - `npm test`: 116 test files passed, 569 tests passed.
  - `npm run check`: TypeScript typecheck (0 errors), ESLint (0 errors), Next.js 16 production build succeeded (Exit code 0).

### 2026-09-12: Multi-Bullet SLO & Comma-Separated Resources Parsing, Food Production Harmonization
- **Files Modified**:
  - `src/features/teaching-documents/curriculum-data/module-1.ts`
  - `src/features/teaching-documents/tvet-standards.ts`
  - `src/features/teaching-documents/tvet-document-viewer.tsx`
  - `src/features/teaching-documents/export-docx.ts`
  - `src/features/teaching-documents/curriculum-content/queries.ts`
- **What Changed**:
  - **Dynamic Multi-Bullet SLO Parser (`parseSLOOutcomes`)**: Enhanced `tvet-standards.ts` and `tvet-document-viewer.tsx` with `parseSLOOutcomes` to split compound sentences (e.g. `Explain culinary terms, plan kitchen layouts, and identify professional kitchen personnel standards`) into discrete, capitalized bulleted lines with trailing periods.
  - **Discrete Comma-Separated Resources Parsing (`parseResourcesList`)**: Updated `parseResourcesList` in `tvet-standards.ts` to split comma-separated instructional resources outside parentheses (e.g. `Food Science (7th Ed), Practical Cookery (4th Ed), Whiteboard, Kitchen layout charts`) into individual bulleted items, each on its own line.
  - **Food Production for Invalids and Convalescents (Unit 13.1.0 / CHN 2203 / CND 1304 / DND 1304 / DHN 1305)**:
    - Extracted the complete statutory 12-topic curriculum from `Diploma Curriculum.pdf` pages 84-91 into `module-1.ts`.
    - Synced all 8 active `curriculum_document_versions` in Supabase with discrete multi-bullet outcomes, activities, and resources.
    - Updated `enrichWithCanonical` to automatically upgrade un-expanded or single-bullet schedules to the rich canonical syllabus schedule.
  - **Table Layout & Header Alignment**: Adjusted column widths and header wrapping in `tvet-document-viewer.tsx` to prevent truncation of `Assessment & Remarks`.
- **Verification Evidence**:
  - `npm test`: 115 test files passed, 567 tests passed.
  - `npm run check`: TypeScript (0 errors), ESLint (0 errors), Next.js 16 build succeeded (Exit code 0).

### 2026-09-12: Exact Theory Specific Objectives Integration for Statutory TVET Learning Outcomes
- **Files Modified**:
  - `src/features/teaching-documents/curriculum-data/module-1.ts`
  - `src/features/teaching-documents/curriculum-data/module-2.ts`
  - `src/features/teaching-documents/curriculum-data/module-3.ts`
- **What Changed**:
  - **Statutory Theory Specific Objectives Extraction**: Extracted the exact lettered clauses (`a)`, `b)`, `c)`, `d)`...) from the "Theory - Specific Objectives" sections of `Diploma Curriculum.pdf` across all sub-modules for all 43 units in Modules I, II, and III.
  - **Statutory Lead-in Formatting**: Every weekly topic strictly begins with the statutory TVET lead-in:
    `By the end of the lesson/topic, the trainee should be able to:`
    followed by each authentic objective on its own bulleted line (e.g., `• Define terms used in entrepreneurship.`, `• Explain the differences between self employment and formal employment.`, etc.).
  - **High-Precision Cleansing**: Purged all OCR scanning typos (e.g. `fonnal` -> `formal`, `ot'` -> `of`, `titetors` -> `factors`, `atreet` -> `affect`, `enttvpt•eneurial` -> `entrepreneurial`, `traincc` -> `trainee`) and removed stray OCR line numbers/code annotations.
  - **Derived Subtopics**: Populated `subTopics` arrays with discrete, non-empty curriculum topics corresponding directly to the statutory objectives.
- **Verification Evidence**:
  - `npm test`: 115 test files passed, 567 tests passed.
  - `npm run check`: TypeScript typecheck (0 errors), ESLint (0 errors), Next.js 16 production build succeeded (Exit code 0).

### 2026-09-12: Full 494-Page Authentic TVET Curriculum OCR Extraction & Zero-Synthesis Engine Mandate
- **Files Modified / Added**:
  - `src/features/teaching-documents/curriculum-data/module-1.ts`
  - `src/features/teaching-documents/curriculum-data/module-2.ts`
  - `src/features/teaching-documents/curriculum-data/module-3.ts`
  - `src/features/teaching-documents/distribution-engine.ts`
  - `src/features/teaching-documents/tvet-standards.ts`
  - `src/tests/tvet-teaching-documents.test.ts`
  - `src/tests/curriculum-harmonization.test.ts`
- **What Changed**:
  - **Full Document Extraction (Diploma Curriculum.pdf)**: Rendered all 247 landscape pages and split them into 494 portrait pages. Processed all 494 pages through Windows Media OCR (`[Windows.Media.Ocr.OcrEngine]`), extracting the raw, authentic TVET statutory text across all 43 units.
  - **Zero-Synthesis Mandate (100% Authentic Content)**: Completely purged all synthetic filler (such as the 461 occurrences of *"Demonstrate practical and theoretical understanding of..."*, generic discussion templates, and fallback synthesis) from the curriculum registry and document generation engine.
  - **Authentic Statutory Sections Populated**: Every unit across Module I, Module II, and Module III is populated with:
    - Authentic unit descriptions (official syllabus Introductions).
    - Authentic unit competencies & learning outcomes (official General Objectives).
    - Authentic weekly topic sequences with statutory sub-module unit titles (e.g. Introduction to Diet Therapy, The Body Tissues, Membranes and Glands, Microscopy, etc.).
    - Authentic Specific Learning Outcomes starting with the TVET statutory bold lead-in **By the end of the lesson/topic, the trainee should be able to:** followed by discrete behavioral objectives.
    - Authentic Pedagogical Learning Activities (from syllabus Suggested Activities).
    - Authentic Instructional Equipment & References (official textbook citations and laboratory materials).
  - **Zero-Synthesis Distribution Engine**: Updated `distribution-engine.ts` and `tvet-standards.ts` so Schemes of Work and Course Outlines draw directly and exclusively from the authentic extracted curriculum data without injecting synthetic objectives.
- **Verification Evidence**:
  - Full test suite passed 100% (`npm test`: 115 test files passed, 567 tests passed).
  - Repository check passed code 0 (`npm run check`: TypeScript 0 errors, ESLint 0 errors, Next.js 16 build succeeded).
- **Manual Follow-up**:
  - None required. All 43 units are instantly active with authentic content for all trainers generating Course Outlines and Schemes of Work.

### 2026-09-12: Complete Purge of Hardcoded RAT/CAT/Exam Schedules & Empty Assessment Row Standards
- **Files Modified / Added**:
  - `src/features/teaching-documents/curriculum-data/module-1.ts`
  - `src/features/teaching-documents/curriculum-data/module-2.ts`
  - `src/features/teaching-documents/curriculum-data/module-3.ts`
  - `src/features/teaching-documents/assessment-milestones.ts`
  - `src/features/teaching-documents/assessment-milestones-actions.ts`
  - `src/features/teaching-documents/assessment-milestones-card.tsx`
  - `src/features/teaching-documents/distribution-engine.ts`
  - `src/features/teaching-documents/tvet-standards.ts`
  - `src/features/teaching-documents/tvet-document-viewer.tsx`
  - `src/features/teaching-documents/export-docx.ts`
  - `src/features/teaching-documents/program-of-activities/types.ts`
  - `src/features/teaching-documents/program-of-activities/queries.ts`
  - `src/features/teaching-documents/record-of-work-actions.ts`
  - `src/tests/tvet-teaching-documents.test.ts`
  - `src/tests/curriculum-zip-ingestion.test.ts`
  - `src/tests/curriculum-harmonization.test.ts`
- **What Changed**:
  - **Purged Hardcoded Assessments from Master Curriculum Data**: Cleaned all 43 units across `module-1.ts`, `module-2.ts`, and `module-3.ts`. Removed hardcoded synthetic Week 8 (CAT) and Week 14 (Exam) rows from non-attachment units, leaving pure authentic syllabus topics. Stripped all `(RAT 1)` / `(CAT)` inline markers from topic titles and sub-topics.
  - **Eliminated RAT (Continuous Assessment Test & Final Exam Only)**: Removed Continuous Assessment 1 (RAT) from all interfaces, drawer controls, and calculations. Standardized on a 2-tier college grading structure: Continuous Assessment Test (CAT, 30% coursework) and End-Term Examination (70% summative).
  - **Dynamic Assessment Milestone Injection**: Week placement for CAT and Final Exam is determined strictly by college-wide institutional setup (`AssessmentMilestones` / `semester_program_activities`), not hardcoded weeks. Non-milestone teaching weeks distribute syllabus topics dynamically across the remaining term weeks.
  - **Empty Assessment Rows Without Synthetic Content**: On configured CAT and Exam weeks, Sub-topics, Specific Learning Outcomes, Learning Activities, and Instructional Resources are generated completely empty (`[]` or `''`). Prohibited synthetic text (e.g. fake behavioral objectives like "Explain principles of Mid-Term theory...", fake culinary assessments, fake question paper resources).
  - **Viewer & Word DOCX Empty State Formatting**: Both `tvet-document-viewer.tsx` and `export-docx.ts` render clean dashes (`—`) without printing bold TVET lead-ins or empty bullet points when assessment rows have no syllabus content.
- **Verification Evidence**:
  - Full test suite passed 100% (`npm test`: 115 test files passed, 567 tests passed).
  - Production check passed code 0 (`npm run check`: TypeScript 0 errors, ESLint 0 errors, Next.js 16 build succeeded).
- **Manual Follow-up**:
  - None required. College assessment dates can be set at `/teaching-documents` or `/teaching-documents/curriculum`.

### 2026-09-12: Scheme of Work Typography & Column Polish + College-Wide Assessment Schedule Setup
- **Files Modified / Added**:
  - `src/features/teaching-documents/assessment-milestones.ts`
  - `src/features/teaching-documents/assessment-milestones-actions.ts`
  - `src/features/teaching-documents/assessment-milestones-card.tsx`
  - `src/app/(dashboard)/teaching-documents/page.tsx`
  - `src/features/teaching-documents/distribution-engine.ts`
  - `src/features/teaching-documents/tvet-standards.ts`
  - `src/features/teaching-documents/tvet-document-viewer.tsx`
  - `src/features/teaching-documents/export-docx.ts`
  - `src/tests/tvet-teaching-documents.test.ts`
  - `src/tests/curriculum-zip-ingestion.test.ts`
  - `src/tests/timetable-generator/planner.test.ts`
  - `src/features/timetable-editor/validation.ts`
- **What Changed**:
  - **Scheme of Work Polish (Sub-topics)**: Sub-topics in each weekly block now occupy discrete individual lines with bold bullet points (`•`) across both web preview (`tvet-document-viewer.tsx`) and Word `.docx` exports (`export-docx.ts`).
  - **Scheme of Work Polish (Specific Learning Outcomes)**: Standardized all specific learning outcomes to begin with the TVET statutory bold lead-in **By the end of the lesson/topic, the trainee should be able to:** followed by individual behavioral outcomes on separate lines with clean bullet formatting.
  - **Scheme of Work Polish (Activities & Resources)**: Pedagogical activities and instructional resources each render on separate lines. Widened the Resources column in both HTML and DOCX tables from 11% to 18% with word wrapping enabled to gracefully accommodate textbook citations, manuals, and laboratory equipment as content expands.
  - **College-Wide Assessment Schedule Setup**:
    - Added scheduled date/period configuration for Continuous Assessment 1 (RAT 1), Mid-Term CAT, and Final Examination (End-Term) in `AssessmentMilestones` and `AssessmentMilestonesCard`.
    - Placed `AssessmentMilestonesCard` prominently on both `/teaching-documents` and `/teaching-documents/curriculum` dashboards so HODs/Admins can configure dates once for the entire college.
    - Added direct "Assessment Schedule" quick link in the document viewer top action bar.
    - Attached college scheduled assessment dates to all trainer Course Outlines (Section 3 weekly schedule & Section 4 evaluation policy) and Schemes of Work (Assessment & Remarks column with date badges and DOCX styling) automatically.
- **Verification Evidence**:
  - Full test suite passed 100% (`npm test`: 115 test files passed, 567 tests passed).
  - Production check passed code 0 (`npm run check`: TypeScript 0 errors, ESLint 0 errors, Next.js 16 build succeeded).
- **Manual Follow-up**:
  - HODs can navigate to `/teaching-documents` to configure the active semester's college-wide dates for CAT and End-Term exams.

### 2026-09-12: Complete TVET KNEC Nutrition Curriculum Extraction & CND/DND Shared Resource Harmonization
- **Files Modified / Added**:
  - `src/features/teaching-documents/curriculum-data/types.ts` [NEW]
  - `src/features/teaching-documents/curriculum-data/module-1.ts` [NEW]
  - `src/features/teaching-documents/curriculum-data/module-2.ts` [NEW]
  - `src/features/teaching-documents/curriculum-data/module-3.ts` [NEW]
  - `src/features/teaching-documents/curriculum-data/shared-map.ts` [NEW]
  - `src/features/teaching-documents/curriculum-data/index.ts` [NEW]
  - `src/features/teaching-documents/curriculum-registry.ts`
  - `src/features/teaching-documents/curriculum-content/queries.ts`
  - `src/features/teaching-documents/distribution-engine.ts`
  - `src/features/teaching-documents/export-docx.ts`
  - `src/tests/curriculum-harmonization.test.ts` [NEW]
- **What Changed**:
  - **Full Curriculum Extraction**: Extracted and synthesized the complete official KNEC TVET Diploma in Nutrition and Dietetics curriculum across all 3 modules (43 units total: 19 units in Module I, 12 units in Module II, 12 units in Module III) from `Diploma Curriculum.pdf`.
  - **Authentic 14-Week Topical Sequences**: Seeded every unit with authentic 14-week topic outlines, discrete subtopics, specific behavioral learning outcomes, diversified pedagogical learning activities, standard instructional resources, and textbook citations (e.g. Ross & Wilson, Guyton & Hall, Krause's Food & The Nutrition Care Process, Prescott Microbiology, WHO guidelines).
  - **Zero Database / Seed Disruption**: The database schema, seeds, sessions, cohorts, stages, and timetables remain 100% untouched; all curriculum resources are stored and consumed purely for document generation (Course Outlines and Schemes of Work).
  - **CND <-> DND Shared Unit Harmonization**: Created `shared-map.ts` containing 329 normalized alias mappings between Certificate (CND) and Diploma (DND) unit codes. Units shared between programmes (e.g., Diet Therapy I, Food Safety & Hygiene, ICT, Communication Skills, Human Anatomy & Physiology, Nutrition in Emergencies, Nutrition Assessment, Meal Planning, Maternal & Child Nutrition, Legal Aspects, etc.) share the exact same underlying curriculum definitions, schedules, and learning materials.
  - **Integrated Master Registry & Non-Destructive Enrichment**: Connected `findCanonicalCurriculum` and `MASTER_CURRICULUM_REGISTRY` into `getUnitCurriculum` in `curriculum-registry.ts`. In `queries.ts`, implemented `enrichWithCanonical` to non-destructively augment any DB-stored versions (trainer uploads or partial templates) with canonical descriptions, competencies, learning outcomes, textbook references, and instructional equipment while preserving custom trainer weekly schedules.
  - **Accreditation Milestones Alignment**: Updated `distributeTopicsAcrossWeeks` in `distribution-engine.ts` so institutional assessment milestones (RAT, CAT, Final Exam) overlay correctly on milestone weeks while preserving topic-specific continuous assessments across all other teaching weeks.
  - **DOCX Clean Typography**: Resolved unicode character fallback issues in `export-docx.ts`.
- **Verification Evidence**:
  - Vitest test suites passed 100% (`src/tests/tvet-teaching-documents.test.ts` and `src/tests/curriculum-harmonization.test.ts`: 17/17 tests passing).
  - `npm run check` completed with code 0 (`npm run typecheck && npm run lint && npm run build`).
  - Next.js 16 production build succeeded across all routes and API endpoints with 0 TypeScript/ESLint errors.
- **Manual Follow-up**:
  - None required. All 43 units are instantly active and accessible for all HODs and trainers when generating Course Outlines and Schemes of Work.


### 2026-09-11: Quality Assurance Teaching Documents — Semester Program of Activities & Standardized SOW/Outline/ROW Engine
- **Files Modified / Added**:
  - `supabase/migrations/20260911070000_semester_program_of_activities.sql` [NEW]
  - `src/features/teaching-documents/program-of-activities/types.ts` [NEW]
  - `src/features/teaching-documents/program-of-activities/queries.ts` [NEW]
  - `src/features/teaching-documents/program-of-activities/actions.ts` [NEW]
  - `src/features/teaching-documents/assessment-milestones.ts`
  - `src/features/teaching-documents/assessment-milestones-actions.ts`
  - `src/features/teaching-documents/curriculum-editor/docx-parser.ts`
  - `src/features/teaching-documents/curriculum-import-v5/xlsx.ts`
  - `src/features/teaching-documents/curriculum-content/queries.ts`
  - `src/features/teaching-documents/curriculum-registry.ts`
  - `src/features/teaching-documents/distribution-engine.ts`
  - `src/features/teaching-documents/tvet-standards.ts`
  - `src/features/teaching-documents/tvet-document-viewer.tsx`
  - `src/features/teaching-documents/export-docx.ts`
  - `src/features/teaching-documents/record-of-work-actions.ts`
  - `src/features/teaching-documents/record-of-work-online/queries.ts`
  - `src/app/api/teaching-documents/export-word/route.ts`
  - `src/app/(staff)/staff/units/[allocationId]/documents/course-outline/page.tsx`
  - `src/app/(staff)/staff/units/[allocationId]/documents/scheme-of-work/page.tsx`
  - `src/tests/tvet-teaching-documents.test.ts`
- **What Changed**:
  - **Semester Program of Activities Architecture**: Implemented database schema (`semester_program_activities`) and domain services allowing semester academic calendar milestones (Orientation, Continuous Assessment Tests, Mid-Term CAT week, Revision week, End of Term Examination week) to be configured centrally and dynamically inherited across all QA teaching documents.
  - **Course Outline Import Route Fixes**: Corrected destructive calendar omission filter in `docx-parser.ts` and `xlsx.ts` so imported syllabi with milestone rows retain their full 14-week curriculum sequence without dropping weeks or distorting distributions.
  - **Document-Type Scoping & Isolation**: Scoped `getApprovedCurriculumForUnitCode` by `documentType` (`course_outline` vs `scheme_of_work`), resolving collisions where an uploaded course outline could overwrite a scheme of work or vice versa.
  - **TVET Accreditation 6-Column Scheme of Work Standard**: Added Column 6 ("Assessment & Remarks") to both the web viewer and Word export (`export-docx.ts`) featuring visual badge highlights for milestone assessment weeks (CAT, RAT, Exam, Revision).
  - **Course Outline Schedule Milestone Guarantees**: Updated `generateTVETCourseOutline` to overlay institutional assessment milestones (CAT week, End of Term Exam week) directly onto the weekly delivery schedule across all units.
  - **Record of Work Milestone Synchronization**: Updated `generateRecordOfWorkFromSchemeAction` and `record-of-work-online/queries.ts` to automatically populate standard QA work-covered and competency descriptions for assessment weeks from the active Semester Program of Activities.
- **Verification Evidence**:
  - `npx vitest run src/tests/tvet-teaching-documents.test.ts src/tests/curriculum-zip-ingestion.test.ts`: 12/12 passed (100%).
  - `npm run typecheck`: Passed with 0 errors (`next typegen && tsc --noEmit`).
  - `npm run lint`: Passed with 0 errors (`eslint`).
  - `npm run build`: Next.js 16.2.12 Turbopack production build completed successfully across all 152 routes and API endpoints.
- **Manual Follow-up**:
  - Apply the migration `supabase/migrations/20260911070000_semester_program_of_activities.sql` to your Supabase project (e.g. via `supabase db push`).
- **Files Modified**:
  - `src/app/(staff)/staff/units/page.tsx`
  - `src/app/(staff)/staff/documents/page.tsx`
  - `src/app/student/documents/page.tsx`
  - `src/features/imports/master-data/master-data-import-upload-form.tsx`
  - `src/features/imports/units/unit-import-upload-form.tsx`
  - `src/features/imports/trainers/trainer-import-upload-form.tsx`
  - `src/features/imports/teaching-allocations/teaching-allocation-import-upload-form.tsx`
  - `src/features/imports/rooms/room-import-upload-form.tsx`
- **What Changed**:
  - **Staff Units Allocation Multi-Column Grid**: Upgraded trainer unit allocation list from single-column vertical stack (`space-y-3`) to a responsive multi-column card grid (`grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3`), furnishing each unit with its cohorts, combined badges, and status badge.
  - **Staff Teaching Documents Grid**: Upgraded trainer teaching documents view from vertical rows to a multi-column card grid (`grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3`), providing quick action buttons for Course Outline, Scheme of Work, and Record of Work per unit.
  - **Student Documents Multi-Column Grid**: Upgraded student document download view from a single-column list card into a high-density 3-column card grid (`grid gap-3 sm:grid-cols-2 lg:grid-cols-3`) with download buttons and version badges.
  - **Excel Import Upload Instructions Pruning**: Pruned long-winded paragraphs across all 5 master data and timetable import upload forms (`master-data`, `units`, `trainers`, `teaching-allocations`, `rooms`) to concise, professional 1-line guidance.
- **Verification**: `npm run check` (`tsc --noEmit`, ESLint, Next.js build) passed with 0 errors across all 152 routes.

### 2026-09-09: Phase 2 — System-Wide Layout Density, Multi-Column Scaling & Microcopy Pruning
- **Files Modified**:
  - `src/app/(dashboard)/students/unit-registration/register/[studentId]/page.tsx`
  - `src/features/student-unit-registration/batch-unit-registration.tsx`
  - `src/features/student-unit-registration/programme-stage-management.tsx`
  - `src/app/(dashboard)/students/unit-registration/stages/page.tsx`
  - `src/app/(dashboard)/students/unit-registration/batch/page.tsx`
  - `src/app/(dashboard)/students/lifecycle-progression/page.tsx`
  - `src/app/(dashboard)/testing/page.tsx`
  - `src/app/(dashboard)/testing/deployments/page.tsx`
  - `src/app/(dashboard)/testing/sign-off/page.tsx`
  - `src/app/(dashboard)/attendance-clinical/class-attendance/analytics/page.tsx`
  - `src/app/(dashboard)/operations/readiness/page.tsx`
  - `src/app/(dashboard)/operations/daily-reports/page.tsx`
  - `src/app/(dashboard)/students/reports/page.tsx`
  - `src/app/(dashboard)/timetable/cohorts/page.tsx`
  - `src/app/(dashboard)/timetable/programmes/page.tsx`
  - `src/app/(dashboard)/timetable/units/page.tsx`
  - `src/app/(dashboard)/assessment/analysis/[assessmentId]/page.tsx`
  - `src/app/(dashboard)/assessment/analysis/page.tsx`
  - `src/features/timetable-editor/editor-workspace.tsx`
  - `src/features/timetable-conflicts/conflict-center.tsx`
  - `src/features/timetable-publication/publication-workspace.tsx`
  - `src/features/imports/master-data/master-data-import-review-page.tsx`
  - `src/features/imports/unit-offerings/unit-offering-import-preview.tsx`
  - `src/app/(dashboard)/operations/page.tsx`
  - `src/app/(dashboard)/operations/action-center/page.tsx`
  - `src/app/(dashboard)/operations/incidents/page.tsx`
  - `src/app/(dashboard)/attendance/page.tsx`
  - `src/app/(dashboard)/teaching-documents/review/page.tsx`
  - `src/app/(dashboard)/timetable/unit-equivalence/page.tsx`
  - `src/app/(dashboard)/timetable/units/import/[batchId]/page.tsx`
  - `src/app/(dashboard)/timetable/unit-offerings/import/[batchId]/page.tsx`
  - `src/app/(dashboard)/timetable/trainers/import/[batchId]/page.tsx`
  - `src/app/(dashboard)/timetable/teaching-allocations/import/[batchId]/page.tsx`
  - `src/app/(dashboard)/timetable/rooms/import/[batchId]/page.tsx`
  - `src/app/(dashboard)/timetable/units/loading.tsx`
  - `src/app/(dashboard)/timetable/unit-offerings/loading.tsx`
  - `src/app/(dashboard)/timetable/trainers/loading.tsx`
  - `src/app/(dashboard)/timetable/teaching-allocations/loading.tsx`
  - `src/app/(dashboard)/timetable/rooms/loading.tsx`
  - `src/app/(dashboard)/timetable/cohorts/loading.tsx`
  - `src/app/(dashboard)/timetable/programmes/loading.tsx`
  - `src/app/(dashboard)/trainers/page.tsx`
  - `src/app/(dashboard)/timetable/units/import/page.tsx`
  - `src/app/(dashboard)/timetable/cohorts/import/page.tsx`
  - `src/app/(dashboard)/timetable/academic-years/page.tsx`
  - `src/app/(dashboard)/timetable/academic-periods/page.tsx`
  - `src/app/(dashboard)/timetable/time-slots/page.tsx`
  - `src/app/(dashboard)/timetable/constraints/page.tsx`
  - `src/app/(dashboard)/timetable/conflicts/page.tsx`
  - `src/app/(dashboard)/timetable/trainers/import/page.tsx`
  - `src/app/(dashboard)/timetable/teaching-allocations/import/page.tsx`
  - `src/app/(dashboard)/timetable/rooms/import/page.tsx`
  - `src/app/(dashboard)/students/unit-registration/page.tsx`
  - `src/app/portal-theme.css`
- **What Changed**:
  - **Eliminated 2-Card Layout Bloat**: Replaced remaining `sm:grid-cols-2 xl:grid-cols-4` patterns with `sm:grid-cols-2 lg:grid-cols-4`, ensuring intermediate desktop and iPad landscape viewports (1024px–1279px) render 4 columns instead of 2 giant stretching cards. Upgraded 5-metric layouts to include intermediate `md:grid-cols-3` breakpoints.
  - **Container Width Standardization**: Replaced legacy `max-w-[1500px]` and `max-w-[1600px]` wrappers with unified `max-w-[var(--content-max-width)]` (90rem/1440px) across stage setup, batch unit registration, and student lifecycle progression.
  - **Multi-Column Checklist & Selection Grids**: Upgraded student unit registration checklists (`expectedUnits`, `otherOfferedUnits`, `curriculumUnits`), stage unit binding checkboxes, and timetable editor missing allocations from 2 columns to responsive 3–4 columns (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`).
  - **Portal Theme Grid Alignment**: Activated 4-column metric grids in `portal-theme.css` at `@media (min-width: 1024px)` instead of waiting for `1280px`.
  - **Loading Skeleton Harmony**: Synchronized all timetable entity loading skeletons with the new `grid gap-3 sm:grid-cols-2 lg:grid-cols-4` layouts to eliminate layout shifting during navigation.
  - **Microcopy Pruning**: Pruned long-winded page header descriptions across 14 dashboard and import views into concise microcopy.
- **Verification**: `npm run check` (`tsc --noEmit`, ESLint, Next.js build) passed with 0 errors across all 152 routes.

### 2026-09-09: Wide-Screen Responsiveness, Multi-Column Density & Microcopy Pruning
- **Files Modified**:
  - `src/app/globals.css`
  - `src/components/layout/admin-sidebar.tsx`
  - `src/components/layout/platform-shell.tsx`
  - `src/components/layout/dashboard-sidebar.tsx`
  - `src/components/layout/student-shell.tsx`
  - `src/components/layout/assessment-shell.tsx`
  - `src/components/staff/staff-shell.tsx`
  - `src/components/student/student-portal-shell.tsx`
  - `src/app/(dashboard)/teaching-documents/page.tsx`
  - `src/app/(dashboard)/assessment/reports/page.tsx`
  - `src/app/student/page.tsx`
  - `src/app/trainer/exam-attendance/page.tsx`
  - `src/features/scheduling-readiness/readiness-dashboard.tsx`
  - `src/features/class-attendance/attendance-schedule-list.tsx`
  - `src/app/(dashboard)/trainers/[id]/page.tsx`
  - `src/app/(dashboard)/timetable/unit-equivalence/page.tsx`
  - `src/features/timetable-generator/generator-issues.tsx`
  - `src/features/imports/unit-offerings/unit-offering-template-download-panel.tsx`
  - `src/features/dashboard/dashboard-view.tsx`
  - `src/app/(dashboard)/operations/page.tsx`
  - `src/app/(dashboard)/operations/action-center/page.tsx`
  - `src/app/(dashboard)/timetable/page.tsx`
  - `src/app/(dashboard)/timetable/unit-offerings/import/page.tsx`
  - `src/app/(dashboard)/students/access/page.tsx`
  - `src/app/(dashboard)/students/page.tsx`
  - `src/features/timetable-conflicts/conflict-center.tsx`
  - `src/features/timetable-publication/publication-workspace.tsx`
  - `src/features/timetable-reports/report-workspace.tsx`
  - `src/tests/admin-dashboard-design.test.ts`
  - `CHANGES.md`
- **What Changed**:
  - **Sidebar Standardization Across All Shells**: Replaced oversized and hardcoded widths (e.g., `w-[272px]` in `student-shell.tsx`, `14.75rem` in staff/student shells) with a unified CSS variable `--sidebar-width: 14.5rem` (232px) and maximum drawer width `max-w-[85vw]`. Eliminated layout shifting and oversized sidebar footprints on widescreen monitors.
  - **Bounded Responsive Content Viewports**: Standardized max content width `--content-max-width: 90rem` (1440px) across `PlatformShell`, `StudentShell`, `AssessmentShell`, `StaffShell`, and `StudentPortalShell`. Prevents excessive whitespace and horizontal bloating on 1920px+ and 4K displays.
  - **Furnished Multi-Column Grid Scaling (Eliminating 2-Card Layout Swelling)**:
    - `teaching-documents/page.tsx`: Replaced 2-metric card strip with 4-metric overview (`grid-cols-2 lg:grid-cols-4`) and replaced single full-width block with 4 actionable cards (Curriculum Library, Student Releases, Review Queue, Outline Editor).
    - `assessment/reports/page.tsx`: Expanded 2 report cards into 4 distinct report generators (`grid-cols-2 lg:grid-cols-4`) with concise summary copy.
    - `student/page.tsx`: Replaced 2 quick-action cards with a balanced 4-column student workspace (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
    - `trainer/exam-attendance/page.tsx`: Expanded card grid from `md:grid-cols-2` to `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
    - `scheduling-readiness/readiness-dashboard.tsx`: Upgraded issues grid from `lg:grid-cols-2` to `sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3` and balanced the bottom row into a 3-column span layout.
    - `class-attendance/attendance-schedule-list.tsx`: Enhanced session grid from `lg:grid-cols-2` to `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`.
    - `timetable/unit-equivalence/page.tsx`: Upgraded subject grid from `lg:grid-cols-2` to `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
    - `timetable-generator/generator-issues.tsx`: Scaled conflicts grid to `sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3`.
    - `trainers/[id]/page.tsx` & `unit-offering-template-download-panel.tsx`: Bounded 2-column layouts with `max-w-5xl` and `max-w-4xl` to preserve high visual density.
  - **Microcopy Purge & Minimally Wordy UI**:
    - Pruned verbose multi-sentence descriptions and repetitive disclaimers across `dashboard-view.tsx`, `operations/page.tsx`, `operations/action-center/page.tsx`, `timetable/page.tsx`, `unit-offerings/import/page.tsx`, `students/page.tsx`, `timetable-conflicts/conflict-center.tsx`, `publication-workspace.tsx`, and `report-workspace.tsx`.
    - Converted rambling helper paragraphs into punchy 2-4 word tags and bulleted guidelines, significantly improving information density.

### 2026-09-09: Unit-Registration-Driven Student Timetable Resolution (Cross-Cohort / Deferment Support)
- **Files Modified**:
  - `src/features/student-portal/queries.ts`
  - `CHANGES.md`
- **What Changed**:
  - **Registration-Driven Timetable Filtering**: Refactored `getStudentPortalTimetable` in `src/features/student-portal/queries.ts` to query `student_unit_registrations` for the student's active registered units in the current academic period.
  - **Cross-Cohort / Deferment Session Resolution**: Resolves the exact unit offering hosting each registered unit (`unit_offerings.cohort_id`), matching the timetable sessions of the cohort teaching those units (e.g. Cohort B for a student of Cohort A who deferred or is retaking units).
  - **Graceful Fallback**: If a student has not registered units yet, falls back to previewing her primary cohort's published schedule.
  - **Root Cause Eliminated**: Eliminated the hardcoded `primaryCohortId === student.cohortId` filter which previously locked deferred students to their old cohort's schedule and completely hid the units they registered for with other cohorts.

### 2026-09-08: Class Attendance Student Roster Repair & Multi-Layer Roster Reconciliation
- **Files Added**:
  - `supabase/migrations/20260908221000_repair_class_attendance_roster.sql`
- **Files Modified**:
  - `src/features/assessment/population-workspace.ts`
  - `src/app/api/staff/attendance/sessions/route.ts`
  - `src/features/class-attendance/queries.ts`
  - `CHANGES.md`
- **What Changed**:
  - **Direct Registered Students Access in Documents**: Updated `getAllocationPopulationWorkspace` in `population-workspace.ts` to make `student_unit_registrations` the primary authoritative roster source for class attendance registers. Removed the exclusionary gate on `student_period_reporting.reporting_status = 'reported'` which caused 0 students to appear because term reporting was in 'pending' status for the semester.
  - **Timetable Snapshot Allocation Resolution & Session Locking**: In `src/app/api/staff/attendance/sessions/route.ts`, added lookup of `teaching_allocations` by `(academic_period_id, unit_id, cohort_id)` when the timetable snapshot omitted `teachingAllocationId`. Automatically updates `scheduled_sessions` to `status = 'locked'`, satisfying the prerequisite for `open_class_attendance_session` RPC.
  - **Attendance Session Student Seeding Fix**: Fixed the fallback in `sessions/route.ts` which was querying non-existent columns `cohort_id` and `status` on `students`. Updated it to seed `class_attendance_entries` directly from `student_unit_registrations` where `registration_status = 'registered'`.
  - **Typo Fix & Roster Self-Healing in Attendance Workspace**: In `src/features/class-attendance/queries.ts`, fixed table name from `class_attendance_records` to `class_attendance_entries` and column `attendance_status`. Added self-healing logic that automatically backfills entries from `student_unit_registrations` if a session had 0 entries previously.
  - **Database Migration**: Created `20260908221000_repair_class_attendance_roster.sql` backfilling `cohort_id` on `student_unit_registrations`, ensuring `department_register_student_units` persists `cohort_id`, and making `open_class_attendance_session` robust across shared and cross-cohort unit registrations.
- **Manual Follow-up**:
  - Run `supabase db push` to apply `20260908221000_repair_class_attendance_roster.sql` to production database.

### 2026-09-08: Class Attendance — Late Registration Logic Fix
- **Files Added**:
  - `supabase/migrations/20260908173000_fix_late_student_attendance.sql`
- **What Changed**:
  - **Late Reporting Fix**: Hardened the `open_class_attendance_session` PostgreSQL RPC to ensure that students who register late (due to fee challenges or other issues) are not retroactively added to past class attendance sheets.
  - Added condition `and registration.registered_at::date <= target_session_date` to the attendance roster snapshot logic. Attendance will now only pick up students from the date they actually register/resume.
- **Manual Follow-ups**:
  - Run `supabase db push` or execute `20260908173000_fix_late_student_attendance.sql` in Supabase SQL editor to apply the changes.

### 2026-09-08: Fix CHN Curriculum Stages & Y2S2 Unit Offerings
- **Files Added**:
  - `supabase/migrations/20260908123000_fix_chn_stages_and_offerings.sql`
- **What Changed**:
  - **Realigned CHN Stages**: Fixed an issue where all `CHN 23xx` units (intended for Year 2 Semester 3) were incorrectly bound to the `Y1S1` stage and had `academic_period_number = 1`. They have been reassigned to `Y2S3` with `academic_period_number = 6`. This fixes the "No stage units" blocker for Y2S3 students.
  - **Provisioned Unit Offerings**: Created active unit offerings for all `CHN 22xx` units (Y2S2) for the `CHN JAN/MAR 25` cohort in the current active period. This resolves the "No matching units on offer" blocker for Y2S2 students in that cohort.
- **Manual Follow-ups**:
  - Run `supabase db push` to push migration `20260908123000_fix_chn_stages_and_offerings.sql` to your Supabase PostgreSQL database.

### 2026-09-08: Student Unit Registration — Missing Cohort Fix
- **Files Added**:
  - `supabase/migrations/20260908113000_fix_department_register_student_units_cohort.sql`
- **What Changed**:
  - **Fixed Database RPC (`department_register_student_units`)**: Corrected an issue where saving unit registrations from the department interface threw an "Academic registration reference not found" error. The previous migration (`20260907091000...`) omitted the required `cohort_id`, `submission_id`, `source`, and `notes` fields in the `INSERT` clause for `student_unit_registrations`.
  - **Maintained Conflict Resolution**: Preserved the new `ON CONFLICT DO UPDATE` upsert logic but populated all required `excluded.*` fields to strictly satisfy the `student_unit_registrations_validate` trigger constraint.
- **Manual Follow-ups**:
  - Run `supabase db push` to push migration `20260908113000_fix_department_register_student_units_cohort.sql` to your Supabase PostgreSQL database.

### 2026-09-07: Registrar Live Reporting Synchronization & Real-time Reconciliation (Phase 2)
- **Files Added**:
  - `src/features/student-reporting-sync/types.ts`
  - `src/features/student-reporting-sync/parsers.ts`
  - `src/features/student-reporting-sync/reconciliation.ts`
  - `src/features/student-reporting-sync/actions.ts`
  - `src/features/student-reporting-sync/reporting-sync-dialog.tsx`
  - `src/tests/students/reporting-sync.test.ts`
- **Files Modified**:
  - `src/app/(dashboard)/students/registry/page.tsx`
  - `src/app/(dashboard)/students/unit-registration/page.tsx`
  - `CHANGES.md`
- **What Changed**:
  - **Multi-Source Ingestion Engine**: Built a robust ingestion pipeline supporting:
    1. **Live Google Sheets**: Normalizes sharing links (`/edit#gid=0`, `/view`, `/pubhtml`, `/pub`) into direct CSV export endpoints and fetches live data over HTTP with clear diagnostics for private permission errors.
    2. **Spreadsheet File Upload**: Parses `.xlsx`, `.xls`, and `.csv` workbooks using `exceljs` with automatic header and pattern recognition.
    3. **Quick Clipboard Paste**: Parses tab/newline-separated rows directly copied from Google Sheets or Excel tables.
  - **Multi-Tenant Safe Reconciliation**: Reconciles incoming admission numbers against active department students and `student_period_reporting` records for the active academic semester. Categorizes rows into `ready` (to activate), `already_reported` (already active), and `unmatched` (unknown to department).
  - **Interactive Review & Confirmation Dialog (`ReportingSyncDialog`)**:
    - Displays real-time KPI metrics (Total Rows, Ready to Activate, Already Active, Unmatched).
    - Features filter pills, instant text search, and per-student exclusion checkboxes.
    - Provides effective date selection and one-click bulk confirmation (`confirm_students_reported` / `batch_update_student_status`).
    - Transitions students to `active`, sets academic phase to `in_class`, updates `student_period_reporting`, and logs audit events.
  - **Surface Placement**: Embedded the "Sync Reporting" dialog directly in both the **Student Registry** (`/students/registry`) and **Unit Registration** (`/students/unit-registration`) action toolbars.
  - **Unit Tests**: Added 10 Vitest assertions in `src/tests/students/reporting-sync.test.ts` verifying URL normalization, CSV/paste parsing, and key normalization. All 34/34 student test assertions passing.

### 2026-09-07: Student Lifecycle — Reactivation & Resumption from Completed Status
- **Files Added**:
  - `supabase/migrations/20260907230000_allow_completed_student_resumption.sql`
- **Files Modified**:
  - `src/features/students/progression-form.tsx`
  - `src/features/students/actions.ts`
  - `CHANGES.md`
- **What Changed**:
  - **Reactivation of Deferred / Repeater Students**: Resolved the domain edge case where students who deferred or repeated studies while their original admission cohort graduated/completed were prematurely marked `completed`, causing them to be excluded from the Student Unit Registration list (`/students/unit-registration`).
  - **Individual Progression Resumption Support**: Updated `record_student_lifecycle_transition` PostgreSQL function and `ProgressionForm` to allow `resumption` transitions from `completed` status back to `active` (and `academic_phase = 'in_class'`), requiring assignment to an active study cohort while keeping the student's original `admission_cohort_id` immutable.
  - **Unit Registration Revalidation**: Added `revalidatePath('/students/unit-registration')` to progression transitions to immediately update unit registration rosters upon reactivation.
  - **Individual Case Resolution**: Updated Felicia Mukami (`CHN/S-4184/IC/24`, `CHN SEP 24`) to `active` status and `in_class` phase, successfully verifying her presence on the unit registration roster.
- **Manual Follow-up**:
  - Run `supabase db push` to deploy `20260907230000_allow_completed_student_resumption.sql`.

### 2026-09-07: Student Registry — Batch Actions, Reporting Confirmation & Lifecycle Management (Phase 1)
- **Files Added**:
  - `supabase/migrations/20260907221500_batch_student_lifecycle_management.sql`
  - `src/features/students/batch-action-dialogs.tsx`
  - `src/tests/students/batch-lifecycle.test.ts`
- **Files Modified**:
  - `src/features/students/types.ts`
  - `src/features/students/validation.ts`
  - `src/features/students/actions.ts`
  - `src/features/students/queries.ts`
  - `src/features/students/student-registry-table.tsx`
  - `src/app/(dashboard)/students/registry/page.tsx`
- **What Changed**:
  - **Multi-Select & Checkbox System**: Added per-row checkboxes, header "select all on page" with indeterminate state, and full cross-page filtered selection in `StudentRegistryTable`.
  - **Cohort-by-Cohort Dropdown Filter**: Added a dedicated cohort filter dropdown in the toolbar alongside existing status pills and instant text search, enabling HODs to immediately isolate any cohort (e.g. `DNDT JAN 24`).
  - **Sticky Batch Action Toolbar**: When 1 or more students are selected, a floating/docked toolbar appears providing 4 core operational actions:
    1. **Confirm Reported**: 1-click batch reporting confirmation that transitions admitted students to `active`, updates `student_period_reporting` for the active semester, and logs user attribution.
    2. **Reassign Current Cohort (Repeaters)**: Safely shifts repeating students to their current study cohort while leaving `admission_cohort_id` permanently intact, creating an entry in `student_cohort_assignments` and logging a `cohort_change` event.
    3. **Mark Deferred**: Enforces required future resumption date and reason, transitions to `deferred`, and updates period reporting.
    4. **Mark Dropped Out**: Enforces required administrative reason, transitions to `dropped_out`, excludes them from active semester rosters, and logs audit events.
  - **Transactional Backend & Fallback**: Created `batch_update_student_status` and `batch_reassign_student_cohort` PostgreSQL RPCs with row locking, tenant department isolation, and graceful TypeScript fallback logic in `actions.ts`.
  - **Unit Testing**: 10 Vitest assertions in `batch-lifecycle.test.ts` verifying all schema rules and constraints.
- **Manual Follow-up**:
  - Run `supabase db push` to push migration `20260907221500_batch_student_lifecycle_management.sql` to your Supabase PostgreSQL database.

### 2026-09-07: Student Unit Registration — View Persistence on Save
- **Files Modified**:
  - `src/features/student-unit-registration/actions.ts`
  - `src/app/(dashboard)/students/unit-registration/register/[studentId]/page.tsx`
- **What Changed**:
  - **Registration Persistence**: In `registerStudentUnitsByDepartment`, replaced the previous redirect to the student list (`redirect('/students/unit-registration?registered=1')`) with a redirect staying directly on the registration editor (`redirect(`/students/unit-registration/register/${studentId}?saved=1`)`).
  - **Success Feedback Banner**: Added an explicit confirmation banner (`saved=1`) confirming that unit registration was saved and verified successfully while maintaining all selected checkboxes and verified status.
  - **Academic Stage Update Feedback**: Added a confirmation badge (`stage_updated=1`) when changing student academic stages.
  - **Explicit Return Navigation**: Added "Return to Student List" navigation buttons in both the header and footer actions, allowing the user to return to the student table whenever they choose rather than being automatically booted out upon saving.

### 2026-09-07: Student Unit Registration — Flexible Unit Selection & DNDT Y1S2 Stage Alignment
- **Files Added**:
  - `supabase/migrations/20260907091000_fix_dndt_stages_and_registration_flexibility.sql`
- **Files Modified**:
  - `src/features/student-unit-registration/types.ts`
  - `src/features/student-unit-registration/queries.ts`
  - `src/features/student-unit-registration/actions.ts`
  - `src/app/(dashboard)/students/unit-registration/register/[studentId]/page.tsx`
- **What Changed**:
  - **DNDT Stage Realignment**: Fixed `programme_stage_units` for DNDT so that `Year 1 Semester 2 (Y1S2)` contains all seven `12xx` units (`DNDT 1201` through `DNDT 1207`) and `Year 1 Semester 3 (Y1S3)` contains all six `13xx` units (`DNDT 1301` through `DNDT 1306`). Realigned `academic_period_number` on the units table to match official curriculum.
  - **Provisioned Unit Offerings**: Created active, included unit offerings for `DNDT 1202` and `DNDT 1207` for `DNDT JAN 26` in the active term (`September-December 2026`), ensuring all 7 Y1S2 units are on offer and eligible for registration.
  - **Removed Restrictive Unit Suppression**: Removed the check in `getDepartmentRegistrationEditor` that previously suppressed any unit not strictly matching `isExpected`.
  - **Flexible Multi-Tiered Unit Registration UI**:
    1. **Expected Stage Units**: Highlighted and pre-checked by default for standard academic progression.
    2. **Other Units Offered This Term**: Shows all other units offered for the student's cohort or programme during the active term, selectable with individual checkboxes.
    3. **Expandable Additional Programme Units (Retakes & Carry-overs)**: Allows HODs to expand and pick ANY unit across the entire programme curriculum for students needing retakes from earlier stages or advance registrations.
  - **Auto-Provisioning in Server Action**: In `registerStudentUnitsByDepartment`, if an HOD selects a valid programme curriculum unit that does not yet have an offering row for the student's cohort in the active period, it is automatically provisioned (`origin: 'special', exception_reason: 'Department unit offering'`) so registration saves seamlessly.
  - **Optional Note Fallback**: Provided default note `'Department authorized registration'` when custom unit selections differ from expected units, preventing form rejections when HODs leave the note blank.

### 2026-09-07: Student Registry — Admission Number Correction with Programme & Cohort Auto-Sync
- **Files Added**:
  - `supabase/migrations/20260907052500_update_student_admission_number.sql`
  - `src/features/students/edit-admission-number-dialog.tsx`
  - `src/tests/students/update-admission-number.test.ts`
- **Files Modified**:
  - `src/features/students/types.ts`
  - `src/features/students/validation.ts`
  - `src/features/students/actions.ts`
  - `src/features/students/student-registry-table.tsx`
  - `src/app/(dashboard)/students/registry/[studentId]/page.tsx`
- **What Changed**:
  - **Programme & Cohort Auto-Synchronization**: When an admission number is corrected to a different programme code (e.g. from `DHNT/...` to `DNDT/...`), the system automatically resolves the corresponding programme and intake cohort (e.g. `DNDT` and `DNDT JAN 26`). Both `students.programme_id`, `students.admission_cohort_id`, `students.current_cohort_id`, and active `student_cohort_assignments` are updated atomically.
  - **Database RPC (`update_student_admission_number`)**: Enhanced PostgreSQL function supporting `new_programme_id` and `new_cohort_id` with row locking, department tenant isolation, uniqueness enforcement, student record updates, active cohort assignment updates, and audit logging to `student_lifecycle_events`.
  - **Server Action Fallback Safety**: In `updateStudentAdmissionNumberAction`, if the database RPC hasn't been migrated yet (`PGRST202` schema cache), it runs the identical update logic directly via Supabase client, maintaining database integrity constraints (`validate_student_academic_identity` and `validate_student_cohort_assignment`).
  - **Compact Fixed-Height Modal (`EditAdmissionNumberDialog`)**: Redesigned to be ultra-compact and fit within any viewport without scrolling (`max-h-[calc(100dvh-2rem)]`). Removed reason chips and extra textareas to keep the modal focused strictly on the student name, current admission number, corrected admission number input, and 1-line inference preview.
  - **Registry UI Placement**: Removed the edit action from the broad registry list table (`/students/registry`) to avoid clutter and prevent accidental edits; the edit dialog is cleanly nested within the student detail page (`/students/registry/[studentId]`).
  - **Unit Testing**: 9 Vitest assertions verifying schema validation, whitespace trimming, character constraints, and inference extraction.
- **Manual Follow-up**:
  - Run `supabase db push` or execute `20260907052500_update_student_admission_number.sql` in Supabase SQL editor to install/update the RPC.

### 2026-09-06: Student Unit Registration — 1-Click Unregister Action Button

- **Files Modified**:
  - `src/features/student-unit-registration/undo-registration-button.tsx`
  - `src/features/student-unit-registration/student-unit-registration-table.tsx`
  - `src/app/(dashboard)/students/unit-registration/page.tsx`
  - `src/app/(dashboard)/students/unit-registration/register/[studentId]/page.tsx`
- **What Changed**:
  - **Enhanced `UndoUnitRegistrationButton`**: Extended the component with customizable variants (`danger`, `outline`, `subtle`), sizes (`sm`, `md`), custom labels, student-specific confirmation messages, and loading spinners.
  - **Row-Level "Unregister" Button on Table**: Added the `Unregister` danger action button directly in the main table row on `/students/unit-registration` for any student who has units registered or submissions (`student.selectedUnits > 0 || student.status !== 'not_submitted'`).
  - **Individual Registration Page Integration**: Placed prominent unregister action buttons on `/students/unit-registration/register/[studentId]` (in both the top stage/status header and the bottom form action bar alongside "Save & verify registration").
  - **Administrative Undo**: Calls `DELETE /api/students/unit-registration/[studentId]/undo`, executing the database RPC `undo_student_unit_registration` to clear registrations and submissions for the target academic period without resetting student stage or cohort.

### 2026-09-06: Database Migration — Fix Unit Offering Withdrawal Exception Reason Check Constraint
- **Files Added**:
  - `supabase/migrations/20260906213500_fix_unit_offering_withdrawal_exception_reason_constraint.sql`
- **What Changed**:
  - **Identified Root Cause**: When withdrawing/dropping a unit offering on `/timetable/unit-offerings`, `selection_state` is updated from `'included'` to `'excluded'`, which failed PostgreSQL table check constraint `unit_offerings_exception_reason_required_check` (`(origin = 'curriculum' and selection_state = 'included') or exception_reason is not null`) because `exception_reason` remained `NULL` on curriculum offerings.
  - **Backfilled Legacy Excluded Rows**: Populated `exception_reason` from `withdrawal_reason` or standard fallback for any existing rows in `selection_state = 'excluded'`.
  - **Relaxed Check Constraint**: Updated `unit_offerings_exception_reason_required_check` to accept `exception_reason is not null OR withdrawal_reason is not null`.
  - **Auto-Guaranteed in `validate_unit_offering` Trigger**: Automatically populates `new.exception_reason` from `new.withdrawal_reason` (or standard fallback) during any `BEFORE INSERT OR UPDATE` trigger where `selection_state = 'excluded'`.
  - **Updated `set_unit_offering_approval` RPC**: Explicitly populates both `withdrawal_reason` and `exception_reason` when withdrawing offerings so authorization updates never violate table constraints.
- **Manual Follow-up**: Run `supabase db push` or run the SQL in Supabase SQL editor to apply `20260906213500_fix_unit_offering_withdrawal_exception_reason_constraint.sql` on the live database.

### 2026-09-06: Student Unit Registration Form & PDF — Vertical Stretch & Dead-Space Elimination below MD Approval
- **Files Modified**:
  - `src/features/student-portal/registration-pdf.tsx`
  - `src/features/student-unit-registration/unit-registration-form-preview.tsx`
  - `src/tests/student-unit-registration-pdf.test.ts`
- **What Changed**:
  - **PDF Layout Flex Restructuring**: Grouped the document into a unified `topSection` (Header, Title, Particulars, Registered Units table), a flex-expanding `approvalsSection` (`flex: 1, flexDirection: 'column', justifyContent: 'space-between'`), and a pinned `footerContainer`.
  - **Eliminated >1 Inch Dead Space**: Removed the hardcoded ~120pt empty gap below Card 6 (MD Approval) by allowing the approvals container to expand dynamically across the remaining printable canvas, placing MD Approval directly above the footer line.
  - **Dynamic Card Dimensions**: Dynamically calibrated `cardRowPaddingY`, `minLineHeight`, and `sectionMarginBottom` based on the registered unit row count, giving ample room for hand-written signatures/comments while guaranteeing strict 1-page A4 compliance across 1 to 12 registered units.
  - **Screen & Print Web Preview Sync**: Maintained unified responsive styling in `UnitRegistrationFormPreview` using flex `justify-between` and `min-h-[290mm] print:min-h-[282mm] print:h-[282mm]` so neither on-screen preview nor browser printing leaves dead white space below Card 6.
  - **Comprehensive Page Count Test Suite**: Added vitest unit tests across 1, 2, 4, 6, 7, 8, 10, and 12 unit permutations confirming all generated PDFs strictly adhere to 1 single page without overflow.

### 2026-09-06: Units on Offer — Bulk & Row-Level Offering Withdrawal Actions
- **Files Modified**:
  - `src/features/unit-offerings/unit-offering-table.tsx`
  - `src/features/unit-offerings/approval-actions.ts`
- **What Changed**:
  - **Bulk Withdrawal Button**: Added a dedicated `Withdraw selected` action button next to `Approve selected` on `/timetable/unit-offerings`, allowing HODs to batch-exclude checked unit offerings from a cohort.
  - **Row-Level Drop Action**: Added a 1-click `Drop from cohort` link button for any unit in `Review required` or `Active` state directly in the Authorization column.
  - **Action Resiliency**: Updated `withdrawUnitOfferingAction` to handle multiple offering IDs and provide an automatic default reason (`"Dropped from cohort teaching plan for this academic period"`).

### 2026-09-06: Student Portal Activation & Sign-In Form Cleanup — Password Terminology
- **Files Modified**:
  - `src/features/student-portal/student-activation-form.tsx`
  - `src/features/student-portal/student-login-form.tsx`
  - `src/features/student-portal/actions.ts`
  - `src/app/student/activate/page.tsx`
- **What Changed**:
  - **Replaced PIN Terminology**: Cleaned up the activation and sign-in experiences to consistently ask students for their **Password** rather than confusing "PIN / Password".
  - **Form Labels & Placeholders**: Updated labels to **Set Password** and **Confirm Password**, with clear placeholders (`Create password (min 4 characters)` and `Re-enter password`).
  - **Action Button**: Simplified the submit button label to **Activate Account**.
  - **Iconography**: Swapped generic key icons for standard `Lock` icons on password fields.
  - **Action Compatibility**: Updated `activateStudentAccount` and `studentPortalLogin` server actions to support `password` / `confirmPassword` while maintaining backward compatibility with existing callers.

### 2026-09-06: Database Migration — Repair `student_portal_credentials` Column & Self-Service Activation RPC
- **Files Added/Modified**:
  - `supabase/migrations/20260906193500_repair_student_portal_credentials_created_at.sql` (NEW)
  - `supabase/migrations/20260905211500_student_self_service_activation.sql`
- **What Changed**:
  - **Added `created_at` Column**: Executed `alter table public.student_portal_credentials add column if not exists created_at timestamptz not null default now()` to eliminate runtime error `column "created_at" of relation "student_portal_credentials" does not exist`.
  - **Repaired Activation RPC (`activate_student_portal_account`)**: Updated the self-service student activation procedure to populate both `issued_at` and `created_at`, safely record audit events to `student_portal_access_events`, and handle missing event tables gracefully without interrupting account activation.
- **Manual Follow-up**: Run `supabase db push` or run the SQL in Supabase SQL editor to apply `20260906193500_repair_student_portal_credentials_created_at.sql` on the live database.

### 2026-09-06: Fix Next.js & TypeScript Build Errors — Docx TableVerticalAlign & WeekdayCode Test
- **Files Modified**:
  - `src/features/student-portal/registration-docx.ts`
  - `src/tests/timetable-generator/planner.test.ts`
- **What Changed**:
  - **Fixed `TableVerticalAlign` Type Error in Docx Generator**: Replaced generic `VerticalAlign` (`'both' | 'center' | 'top' | 'bottom'`) with the docx table-specific `VerticalAlignTable` enum (`'center' | 'top' | 'bottom'`), eliminating the TS2322 assignment error in `buildStudentUnitRegistrationDocx`.
  - **Fixed `WeekdayCode` Casing Error in Planner Test**: Corrected capitalized `'Wednesday'` to canonical lowercase `'wednesday'` on `PlanningWorkingDay.dayOfWeek` in `src/tests/timetable-generator/planner.test.ts`.

### 2026-09-06: Fix Next.js Build Type Errors — Button Variant, Badge Variant & StudentPortalUnit Property
- **Files Modified**:
  - `src/app/(dashboard)/trainers/[id]/page.tsx`
  - `src/app/(dashboard)/students/registry/[studentId]/portal-view/page.tsx`
  - `src/app/(dashboard)/trainers/[id]/portal-view/page.tsx`
  - `src/app/student/unit-registration/page.tsx`
- **What Changed**:
  - **Fixed `ButtonVariant` Error**: Replaced invalid `variant="default"` on `<Button>` with valid `variant="primary"` on the trainer profile page (`src/app/(dashboard)/trainers/[id]/page.tsx`).
  - **Fixed `unitTitle` Property Error**: Replaced non-existent `unit.unitTitle` lookup with canonical `unit.unitName` on `StudentPortalUnit` in student portal view.
  - **Fixed Badge Variant Error**: Replaced invalid `variant="outline"` prop usages on `<Badge>` components with valid `variant="neutral"` across student and trainer portal view pages and unit registration form previews.

### 2026-09-06: Admin Sidebar Navigation Vertical Spacing Update
- **Files Modified**:
  - `src/components/layout/admin-sidebar.tsx`
- **What Changed**:
  - **Increased Vertical Spacing**: Increased item list spacing from `space-y-0.5` to `space-y-2` and link padding from `py-2` to `py-2.5`, giving navigation items room to breathe and improving target area ergonomics.

### 2026-09-06: Enterprise Admin Route — Staff / Trainer Portal Workspace Preview & Access Buttons
- **Files Added/Modified**:
  - `src/app/(dashboard)/trainers/[id]/portal-view/page.tsx` (NEW)
  - `src/app/(dashboard)/timetable/trainers/[id]/portal-view/page.tsx` (NEW)
  - `src/app/(dashboard)/trainers/[id]/page.tsx`
  - `src/features/trainers/trainer-table.tsx`
- **What Changed**:
  - **New Admin Preview Route (`/trainers/[id]/portal-view`)**: Implemented an enterprise-grade admin inspection page allowing HODs and administrators to inspect any trainer's personal staff portal workspace directly.
  - **Staff Directory Row Action**: Added an eye icon button (`View Staff Portal`) directly into the actions column of every trainer row in `TrainerTable` (`/trainers` and `/timetable/trainers`).
  - **Profile Page Placements**: Prominently added **"View Staff Portal"** action buttons across multiple touchpoints on trainer details pages (`/trainers/[id]`):
    1. Top PageHeader actions bar
    2. Active Workspace Authorization banner
    3. Assigned Teaching Allocations section header

### 2026-09-06: Main Dashboard Student Portal Telemetry Update
- **Files Modified**:
  - `src/features/dashboard/dashboard-view.tsx`
- **What Changed**:
  - **Purged Legacy "PINs Active" Terminology**: Replaced outdated legacy `185 PINs active` subtext on the main HOD dashboard **Students Portal** telemetry card with `{studentsPortalActive} Accounts active`.
  - **Updated Telemetry Ratios**: Aligned metric main display to show `{studentsPortalActive} / {studentsEligible}` (e.g., `65 / 185` active accounts vs total student population), accurately reflecting self-service account activations.

### 2026-09-06: Marks Entry Editor UI — Cream Background & Square Input Fields
- **Files Modified**:
  - `src/features/staff-assessment/online-marks-editor.tsx`
- **What Changed**:
  - **Cream Background Fill**: Replaced plain white background on mark input fields and grid containers with an institutional warm cream background (`bg-[#fffdf5]` for inputs, `bg-[#fbf9f1]` / `bg-[#f2ece0]` for containers and table headers), eliminating glare and giving the online markbook an official grade-register feel.
  - **No Rounded Input Fields (`rounded-none`)**: Removed pill/oval border radii (`rounded-lg` / `rounded-full`) across all numeric mark input boxes, search filters, mode toggles, and page control buttons, switching to crisp rectangular `rounded-none` inputs.

### 2026-09-06: Industry-Level Hardening & Consolidation of Staff Unit Allocations ("My Units")
- **Files Modified**:
  - `src/features/staff-assessment/unit-grouping.ts`
  - `src/tests/staff-unit-grouping.test.ts`
  - `src/app/(staff)/staff/units/page.tsx`
  - `src/app/(staff)/staff/units/[allocationId]/page.tsx`
- **What Changed**:
  - **Canonical Unit Key Normalization**: Updated `groupStaffUnitAllocations` in `unit-grouping.ts` to group trainer allocations by canonical unit title and normalized unit code (`canonicalUnitKey`), replacing raw `unit_id` UUID keying. This permanently prevents unit card splitting when identical or shared units (e.g. *Nutrition Epidemiology* across `DHN MAY 24` and `DNDT JAN 26`) have different database `unit_id` UUIDs across programmes.
  - **Multi-Cohort Aggregation**: Added `primaryAllocationId`, `allAllocationIds`, `cohortIds`, `cohortNames`, and `combinedCohortLabel` (e.g., `"DHN MAY 24 + DNDT JAN 26"`) to `GroupedStaffUnitAllocation`.
  - **Staff Units UI Hardening**: Updated `/staff/units` to display single consolidated cards with cohort pill badges (`DHN MAY 24`, `DNDT JAN 26`) and a `Combined (X Cohorts)` indicator tag. Updated `/staff/units/[allocationId]` to render the combined cohort description in the page header.
  - **Automated Test Hardening**: Expanded `staff-unit-grouping.test.ts` test suite covering multi-UUID canonical title matching, formatting variations, distinct unit isolation, and academic period boundaries.

### 2026-09-06: Desktop Optimization for View as Student & Unit Registration Pages
- **Files Modified**:
  - `src/components/student/student-portal-shell.tsx`
  - `src/app/student/unit-registration/page.tsx`
  - `src/app/(dashboard)/students/registry/[studentId]/portal-view/page.tsx`
- **What Changed**:
  - **Eliminated Double Sidebar & Left Offset in Admin Preview**: Fixed `StudentPortalShell` when rendering in Admin Preview mode (`isAdminPreview = true`) to bypass the duplicate fixed left student sidebar and remove the extra `lg:pl-[14.75rem]` (236px) left padding that caused a large empty gap inside the admin dashboard layout.
  - **Ultra-Wide Screen Width Expansion**: Updated `StudentPortalShell` main content container to `w-full max-w-[1600px] lg:px-8`, eliminating awkward centered margins between the left navigation sidebar and main content cards on high-resolution displays (1080p, 1440p, 4K).
  - **Desktop 2-Column Split Layout**: Replaced the stacked single-column layout with a responsive 2-column grid (`xl:grid xl:grid-cols-12 xl:gap-6`) on large viewports (`xl:` 1280px and `2xl:` 1536px).
    - **Left Column (`xl:col-span-5` / `2xl:col-span-4`)**: Sticky sidebar featuring student overview details, registration and reporting status badges, quick export PDF & print buttons, a physical clearance checklist guide, and an assigned units quick summary list.
    - **Right Column (`xl:col-span-7` / `2xl:col-span-8`)**: Centered A4 form canvas displaying the single-page `UnitRegistrationFormPreview` with document preview header and shadow canvas borders.
  - **Mobile/Tablet Compatibility**: Retained clean single-column stacked rendering on viewports smaller than `xl` (< 1280px) and preserved `print:hidden`/`print:block` directives for strict 1-page A4 printing.

### 2026-09-06: Student Registry Search, Column Sorting & Pagination Implementation
- **Files Added/Modified**:
  - `src/features/students/student-registry-table.tsx` (NEW)
  - `src/app/(dashboard)/students/registry/page.tsx`
- **What Changed**:
  - **Real-Time Registry Search**: Added an interactive search toolbar filtering by Student Name, Admission Number, Programme Code/Name, Cohort Name, and Stage Code with instant input feedback and a clear search action.
  - **Status Pill Count Badges**: Added dynamic count badges on each status filter pill (`All (310)`, `Active (185)`, `Deferred`, `Dropped out`, `Completed`, `Graduated`).
  - **Column Sorting**: Added interactive column sorting toggles for Student Name, Programme, Cohort, and Status / Stage columns.
  - **Full Pagination Controls**: Integrated `@/components/ui/pagination` providing page size selection (`15`, `25`, `50`, `100` records per page, default 25), "Showing X to Y of Z records" counters, and page navigation controls (`First`, `Previous`, `Next`, `Last`). Removed hardcoded `slice(0, 100)` limit.






### 2026-09-05: Student Portal Results UI Hidden
- **Files Modified**:
  - `src/components/student/student-portal-shell.tsx`
  - `src/app/student/page.tsx`
  - `src/app/student/results/page.tsx`
- **What Changed**:
  - Removed **Results** navigation links from `StudentPortalShell` sidebar and mobile bottom navigation bar.
  - Removed the **Results** metric card from the Student Portal Dashboard.
  - Redirected direct `/student/results` route requests back to the Student Portal main dashboard (`/student`).

### 2026-09-05: Complete Purge of Obsolete Admin PIN Issuance Buttons & Security Register Shift
- **Files Modified**:
  - `src/features/student-access/access-manager.tsx`
  - `src/app/(dashboard)/students/access/page.tsx`
- **What Changed**:
  - Completely purged obsolete admin PIN issuance elements: `Issue Missing PINs` button, `Rotate All PINs (Excel)` button, and `Rotate PIN` row actions.
  - Converted `/students/access` into a clean **Student Account Security & Activation Register** focused strictly on tracking self-service account activations (`Activated` vs `Not Activated`), account locks, and access controls (`Disable Access` / `Enable Access`).

### 2026-09-05: Mobile-Native Student Portal Shell & Conditional Document Action Buttons
- **Files Modified**:
  - `src/components/student/student-portal-shell.tsx`
  - `src/components/ui/print-action-button.tsx`
  - `src/app/(dashboard)/students/registry/[studentId]/portal-view/page.tsx`
  - `src/app/student/unit-registration/page.tsx`
- **What Changed**:
  - Conditionally rendered the **"Print / PDF"** and **"Download Form (.docx)"** action buttons so they only display when registered units exist (`units.length > 0`) for the active period. When 0 units exist, the buttons are hidden to prevent user confusion.
  - Re-architected action buttons into a balanced 50/50 equal-width grid (`grid grid-cols-2 gap-2`), eliminating mismatched vertical brick-style green pills on mobile.
  - Replaced horizontal scrollbars and truncated pill tabs with a clean 3-segment control bar (`grid grid-cols-3 gap-1 bg-surface-subtle p-1 rounded-lg border border-border`), guaranteeing zero text truncation or scroll tracks.
  - Upgraded `StudentPortalShell` with an integrated 4-item **Mobile Bottom Navigation Bar** (`Dashboard`, `Registration`, `Timetable`, `Results`), complete with active indicator pills and `isAdminPreview` tab-routing support.

### 2026-09-05: Unit Registration Form API Authentication & Friendly HTML Error Pages
- **Files Modified**:
  - `src/app/api/student/unit-registration/form/route.ts`
  - `src/app/api/students/unit-registration/[studentId]/form/route.ts`
  - `src/app/(dashboard)/students/registry/[studentId]/portal-view/page.tsx`
- **What Changed**:
  - Added institutional HTML error page rendering (`renderHtmlErrorPage`) when direct browser navigations encounter `404` (no registered units) or `401` (auth required), eliminating unstyled raw JSON outputs in browser tabs.
  - Updated `/api/student/unit-registration/form` to support dual authentication: accepts `?studentId=...` for HOD/Admin sessions via `requireHodAccess()` while preserving student portal session authentication (`getStudentPortalSession()`).
  - Updated the Admin "View as Student" portal preview download link to point directly to `/api/students/unit-registration/${context.student.id}/form`.

### 2026-09-05: Student Portal Access & Activation Tracking Workspace
- **Files Modified**:
  - `src/app/(dashboard)/students/access/page.tsx`
  - `src/config/navigation.ts`
  - `src/features/dashboard/dashboard-view.tsx`
- **What Changed**:
  - Updated the Student Access Control Center at `/students/access` to focus on real-time tracking of self-service account activations (`Accounts Activated`, `Active Access`, `Locked Accounts`, `Never Activated`).
  - Added `Users` icon import to `src/config/navigation.ts` resolving missing symbol `ReferenceError`.
  - Added dedicated **"Student Registry"** navigation item (`/students/registry`) under `Platform` in sidebar navigation.
  - Linked the **"Students Portal"** metric card on the Admin Dashboard directly to `/students/registry` with interactive hover states and arrow shortcuts.
  - Added a dedicated **"Student Registry"** module tile to the Department Core Modules grid (expanding operational workspaces to 8 core modules).

### 2026-09-05: Student Self-Service Account Activation & Admin PIN Purge
- **Files Added/Modified**:
  - `supabase/migrations/20260905211500_student_self_service_activation.sql` [NEW]
  - `src/features/student-portal/student-activation-form.tsx` [NEW]
  - `src/app/student/activate/page.tsx` [NEW]
  - `src/features/student-portal/actions.ts`
  - `src/features/student-portal/student-login-form.tsx`
  - `src/app/(dashboard)/students/unit-registration/page.tsx`
- **What Changed**:
  - Replaced manual admin PIN generation/issuance with a self-service student activation workflow (`/student/activate`).
  - First-time students activate their accounts using their **Full Admission Number** + **Registered Phone Number** and set their own preferred PIN/password.
  - Purged the admin "Issue Access PINs" UI button from the unit registration dashboard.
  - Added timestamped SQL migration creating `public.activate_student_portal_account` RPC with bcrypt hashing (`extensions.crypt`).

### 2026-09-05: Assessment Module Design Standardization & Theme Alignment
- **Files Modified**:
  - `src/components/layout/assessment-shell.tsx`
  - `src/features/assessment/assessment-control-center.tsx`
- **What Changed**:
  - Aligned `AssessmentShell` with the benchmark **Deep Teal Brand Theme (`#033B36`)**, replacing the dark navy slate sidebar (`bg-slate-900`) with gold-ringed academic crest headers, active item indicators (`#FACC15`), and top institutional yellow accent lines.
  - Standardized `AssessmentControlCenter` telemetry metric cards, tab switchers ("All Markbooks", "CAT Analysis", "Exam Analysis"), search/status filters, and data tables to match the Schools / Departments interface standard.

### 2026-09-05: Unit Registration Search, Multi-Filter, Pagination & Workflow Simplification
- **Files Added/Modified**:
  - `src/features/student-unit-registration/student-unit-registration-table.tsx` [NEW]
  - `src/app/(dashboard)/students/unit-registration/page.tsx`
  - `src/app/student/unit-registration/page.tsx`
  - `src/features/student-unit-registration/batch-unit-registration.tsx`
- **What Changed**:
  - Built real-time `StudentUnitRegistrationTable` component featuring live search (Name / Admission No.), multi-criteria filter dropdowns (Status, Reporting State, Cohort), and client-side pagination (10, 25, 50 rows per page with page controls).
  - Simplified row action buttons on the admin unit registration management table to a single primary action button: **"Register Units"** (or **"Manage Units"**).
  - Standardized primary batch registration button to **"Register Units (N)"**.
  - Clarified Student Portal unit registration workflow with official guidance callouts, read-only prefilled form protection, and clear **"Download Prefilled Form (.docx)"** & **"Print / Save PDF"** download buttons.

### 2026-09-05: AI Agent Guardrails & Governance Upgrade
- **Files Modified**:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `CHANGES.md`
- **Summary**:
  - Maximized `AGENTS.md` into the primary repository guardrail file covering Next.js 16 async route parameters (`await params`), React 19 standards, multi-tenant department isolation rules (RLS), TVET document composite template conventions, database migration rules, and mandatory verification procedures (`npm run check`).
  - Updated `CLAUDE.md` with Claude Code CLI terminal shortcuts, project directory maps, and rapid inspection paths.
  - Formatted `CHANGES.md` as the authoritative Architectural Delta Registry for tracking project updates and technical debt across all AI models.

### 2026-08-22: Teaching-Documents Fix — Per-Type Curriculum Registry & Ingestion
- **Files Replaced**:
  - `src/features/teaching-documents/zip-ingestion.ts`
  - `src/features/teaching-documents/curriculum-registry.ts`
  - `src/features/teaching-documents/zip-ingestion-actions.ts`
  - `src/features/teaching-documents/tvet-standards.ts`
  - `src/features/teaching-documents/record-of-work-actions.ts`
- **What Changed**:
  - ZIP ingestion now detects document type (`scheme_of_work` vs `course_outline`) per file instead of merging/overwriting content across types for the same unit code.
  - `persistUnitCurriculumToDatabase` saves detected types under composite template IDs (`tpl-tvet-<code>-<type>`) instead of one shared ID per unit.
  - `generateTVETCourseOutline` and `generateTVETSchemeOfWork` each pull their own document-typed curriculum instead of sharing one registry slot.
  - Record of Work preload specifically loads the `scheme_of_work` variant.
  - Ingestion commit action rejects files without a confirmed document type, returning `unresolvedFiles` in preview for unclassified files.

---

## Standard LLM Change Entry Template

When logging changes, copy and fill out the template below:

```markdown
### YYYY-MM-DD: [Feature Title / Description]
- **Files Added/Modified/Deleted**:
  - `path/to/file1.ts`
  - `path/to/file2.tsx`
- **What Changed**:
  - Detailed bullet points of structural, database, or algorithmic changes.
- **Breaking Changes / DB Migrations**:
  - Any SQL migrations added (`supabase/migrations/YYYYMMDDHHMMSS_name.sql`).
- **Manual Follow-ups**:
  - Steps required by developers or admins (e.g. running `npx supabase db push`).
```
