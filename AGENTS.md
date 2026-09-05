<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Repository Guardrails & Operating Instructions

Welcome, AI Agent or LLM! This project is an enterprise-grade **Academic Timetabler & Department Management System** (Nutrition & Health Sciences Department). 
Follow these non-negotiable repository instructions, coding standards, and domain rules on **every** code modification.

---

## 1. Core Tech Stack & Architecture

- **Framework**: Next.js 16 (App Router in `src/app`) with React 19.
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`), Radix UI primitives, Lucide React.
- **Database & Auth**: Supabase PostgreSQL with RLS, `@supabase/ssr`, `@supabase/supabase-js`.
- **Testing**: Vitest (`@vitest/coverage-v8`).
- **Document & Data Processing**: ExcelJS, `docx`, `@react-pdf/renderer`, `zod`.
- **Language**: TypeScript 5 (Strict Mode, `type: module`).

### Modular Architecture Layout
- `src/app/` — Next.js 16 routes, API endpoints (`src/app/api/`), layout, and page composition.
- `src/components/` — Reusable, atomic UI components (dialogs, tables, buttons, inputs).
- `src/features/` — Business domain feature slices (timetabling, teaching-documents, attendance, assessment, students).
- `src/lib/` — Infrastructure helpers, Supabase clients, timetabling solver algorithms, utility functions.
- `src/types/` — Authoritative TypeScript domain interfaces and database type definitions.
- `supabase/migrations/` — Versioned, timestamped PostgreSQL migrations.
- `docs/` — Architectural notes, smoke tests, and production matrices.

---

## 2. Non-Negotiable Agent Rules & Guardrails

### A. Next.js 16 & React 19 Standards
1. **Async Route Parameters**: In Next.js 16, `params` and `searchParams` passed to pages/layouts/route handlers are **Promises**. You MUST await them:
   ```ts
   // Correct
   export default async function Page({ params }: { params: Promise<{ id: string }> }) {
     const { id } = await params;
   }
   ```
2. **Server vs Client Boundaries**: Mark client components explicitly with `"use client"` at the very top. Keep client bundles minimal by pushing data fetching and heavy logic into Server Components or Server Actions.
3. **Imports**: Prefer modular ESM imports.

### B. Strict Code Quality & Zero-Suppression Policy
1. **No Type Hacks**: NEVER bypass TypeScript or ESLint errors using `@ts-ignore`, `@ts-nocheck`, `any` type casts, or commenting out assertions. Fix the root type contract or interface.
2. **Preserve Comments & Code Context**: Do not remove existing docstrings, explanatory comments, or adjacent unrelated logic when refactoring.
3. **Function Signature Updates**: If you update a function signature or API route, perform a codebase-wide search and update all invocation sites (`src/features/`, `src/app/`, `tests/`).

### C. Verification Mandate
Before reporting ANY task, bugfix, or feature as complete, you MUST execute:
```bash
npm run check
```
*(This runs `npm run typecheck && npm run lint && npm run build`)*. Also run unit tests when applicable:
```bash
npm test
```
Never declare success without concrete runtime/build verification evidence!

---

## 3. Database & Supabase Safety Rules

1. **Migrations First**: All schema updates, table additions, column modifications, or RLS policy updates MUST be performed via timestamped SQL files in `supabase/migrations/` (format: `YYYYMMDDHHMMSS_feature_name.sql`).
2. **Never Break Legacy Schemas**: Do NOT drop existing columns or tables without backward-compatible dual-read logic or explicit migration scripts.
3. **Multi-Department Tenant Isolation**: 
   - Tables with department data include `department_id`.
   - All queries and Row Level Security (RLS) policies MUST respect the user's active working department (`department_id`).
   - Cross-department operations (e.g., room/trainer collision checks) must treat external departmental occupancy as protected without leaking external details.

---

## 4. Key Domain Rules & Business Logic

### A. Timetabling & Workload Allocation
- **Calendar Slots**: Standard sessions are Morning (08:00–10:00), Mid-Morning (10:30–12:30), and Afternoon (14:00–16:00).
- **Trainer Hours**: Trainers have `normal_hours` (soft warning threshold) and `max_hours` (hard maximum limit across all departments).
- **Shared Classes**: Equivalent units across programmes (e.g. Communication Skills across CND and DND) share HOD-confirmed delivery slots.
- **Service Units & Fixed Constraints**: Service unit slots and trainer free times are hard constraints during timetable generation.

### B. TVET Teaching Documents & Curriculum Registry
- **Document Classification**: Ingestion MUST distinguish per file between `scheme_of_work` and `course_outline`.
- **Composite Template IDs**: Curriculum records are stored using composite IDs in the format `tpl-tvet-<code>-<type>` (e.g. `tpl-tvet-CND1201-scheme_of_work`). NEVER merge or overwrite a scheme of work with course outline data under a single unit ID.
- **Unresolved Files**: Document ingestion previews that cannot classify a document type return `unresolvedFiles` requiring manual HOD type assignment before commit.

### C. Student Progression & Assessments
- Student onboarding, stage progressions, unit markbooks (single/multi-unit), exam absence portals, and attendance oversight rely on stage bindings (`programme_stages`). Keep stage sequence logic aligned with `canonical_programme_stage_sequence`.

---

## 5. Agent Logging Protocol (`CHANGES.md`)

Whenever you complete a refactor, database migration, or structural change:
1. Update `CHANGES.md` under the **Recent Updates** section.
2. List all modified/added files.
3. Detail what changed, breaking changes, and any manual follow-up steps required (e.g. database push, UI updates).
