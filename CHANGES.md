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

---

## Recent Architectural Updates

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
