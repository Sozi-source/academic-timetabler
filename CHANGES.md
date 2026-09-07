# CHANGES.md — Architectural Delta Registry & Project Changelog

This document tracks all architectural modifications, schema updates, bugfixes, breaking changes, and pending manual follow-up tasks across the codebase. 

> **Instruction for AI Agents & Developers**: Any time you update, refactor, or migrate code in this project, append a summary of your changes under [Recent Architectural Updates](#recent-architectural-updates) following the standard format below.

---

## Active Pending Actions & Technical Debt

1. **Teaching Documents — Legacy Template ID Migration**:
   - Legacy DB rows stored curriculum templates under `tpl-tvet-<code>` (without document type suffix). A migration is needed to reclassify each row as either `scheme_of_work` or `course_outline` and re-save under `tpl-tvet-<code>-<type>`.
2. **Curriculum Upload UI Update (`curriculum-zip-upload-dialog.tsx`)**:
   - Update `curriculum-zip-upload-dialog.tsx` to display `unresolvedFiles` from the ingestion preview response, allowing HODs to select document types manually prior to commit.
3. **Source Data Organization (`Course_outlines.zip`)**:
   - Move Milkah Wambui's Learning Plan (scheme of work) from the "course outlines" folder to the correct "schemes of work" folder before re-ingesting.

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
