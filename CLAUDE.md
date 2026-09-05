@AGENTS.md

# CLAUDE.md — Claude Code Execution & Navigation Guide

This file provides Claude Code CLI and Anthropic agents with immediate workspace shortcuts, terminal commands, directory structures, and rapid inspection pathways. All non-negotiable repository guardrails are inherited directly from `@AGENTS.md` above.

---

## 1. Quick Terminal Commands

```bash
# Development Server
npm run dev

# Full Quality Check (Typecheck + Lint + Build) — MANDATORY BEFORE COMPLETION
npm run check

# Individual Checks
npm run typecheck
npm run lint
npm run build

# Unit & Integration Testing
npm test

# Supabase Local & Database Push Commands
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

---

## 2. Directory Navigation Map

```
c:/Users/sozi/Desktop/academic-planner/
├── AGENTS.md                  # Universal repository guardrails & domain laws
├── CHANGES.md                 # Architectural delta log & pending manual follow-ups
├── CLAUDE.md                  # Claude Code navigation & execution guide (this file)
├── docs/                      # Architecture notes, smoke tests & release specs
├── src/
│   ├── app/                   # Next.js 16 App Router (pages, layouts, API endpoints)
│   │   ├── (auth)/            # Login, registration, password reset
│   │   ├── (dashboard)/       # Admin/HOD timetabling & management dashboard
│   │   ├── (staff)/           # Trainer/staff portal views
│   │   └── api/               # Server API routes (curriculum, timetable, attendance, operations)
│   ├── components/            # Reusable React components & UI primitives (Radix/Tailwind v4)
│   ├── features/              # Feature modules (teaching-documents, timetable, attendance, assessment)
│   ├── lib/                   # Infrastructure, Supabase SSR client, timetabling algorithm engine
│   └── types/                 # Shared TypeScript interfaces & database schemas
└── supabase/
    └── migrations/            # 180+ PostgreSQL timestamped SQL migrations
```

---

## 3. High-Priority Domain Logic Quick Reference

1. **Next.js 16 Async Route Parameters**: Always `await params` and `await searchParams` in pages and route handlers.
2. **TVET Teaching Documents Ingestion**:
   - Template IDs are strictly composite: `tpl-tvet-<code>-<type>` (e.g. `tpl-tvet-CND1201-scheme_of_work`).
   - Scheme of work and course outline data are saved under separate IDs per unit.
3. **Multi-Department RLS**:
   - Ensure `department_id` filtering is present in database calls and RLS policies.
4. **Workload & Timetabling**:
   - Check `normal_hours` (warning limit) vs `max_hours` (hard institutional cap across all departments).
5. **Quality Verification**:
   - Always run `npm run check` after making edits and before concluding tasks.
