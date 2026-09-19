# Changes Plan — Incremental Timetable Editing

Status: **in progress**. Pick up from here if the session restarts.
This file ships inside the delivered zip at the project root — always check it
first before re-doing work.

## Progress log
- [x] **Task 1 — RPC scope fix** (see below). Done in
  `supabase/migrations/20260919100000_scope_move_session_trainer_propagation.sql`.
  This is a *new* migration (existing applied migrations were left untouched,
  matching the project's own pattern of redefining the function again rather
  than editing history). Run `supabase db push` (or your normal migration
  deploy step) to apply it.
- [x] **Task 2 — Quick Edit actions** (see below). Done in
  `src/features/timetable-quick-edit/{types,validation,actions}.ts`. Three
  single-purpose actions (`quickMoveScheduleAction`, `quickReassignRoomAction`,
  `quickReassignTrainerAction`) plus `quickUndoLastChangeAction`, each
  revalidating only `/timetable/quick-edit` — not the full editor's 5-route
  fan-out. **Assumption to confirm**: the route path `/timetable/quick-edit`
  is a placeholder since Task 5 (UI) hasn't picked a real location yet —
  update `refreshQuickEdit()` if the actual route differs.
- [x] **Task 3 — Quick Edit query** (see below). Done in
  `src/features/timetable-quick-edit/{query-types,queries}.ts`. One entry
  point, `getQuickEditData(sessionId, field)`, that loads the single session
  row plus only the option list the requested field needs — never the full
  editor's 9-query bundle, never the institution-wide cohort/trainer/room
  lists.
- [ ] Task 4 — Trim clash diagnostic (not started)
- [ ] Task 5 — Minimal UI (not started)
- [ ] Task 6 — Guardrails review (not started, ongoing check on every task)

## Goal (one line)
A minor edit (move/room/trainer swap on one session) must touch *only that session row* — no regeneration, no re-check of untouched sessions, no full-editor reload.

## Enterprise pattern this follows
Real timetabling systems (Syllabus Plus, Aula, FET) separate two operations that must never blur:
- **Generate/Solve** — full or partial re-solve, run explicitly, touches many sessions.
- **Adjust** — a surgical, single-row change with local clash checks only. Never re-triggers Generate.

The codebase already has this split at the RPC layer (`schedule_allocation_session_safely`/`move_scheduled_session_safely` = Adjust, the generator = Generate/Solve). **The plan below is only about not fighting that split at the app layer** — today's app layer re-fetches like it just ran Generate every time someone does an Adjust.

## What "only affected sessions" means concretely
An edit is allowed to touch:
1. The one `scheduled_sessions` row being moved.
2. Any session it *directly clashes with* (read-only, for the error message — never written to).
Nothing else — not sibling sessions of the same allocation, not the whole day, not the whole period grid.

Known deviation to fix: `move_scheduled_session_safely` currently also updates `trainer_id` on **all active sibling sessions** of the same teaching allocation, and on the parent `teaching_allocation` row, even for a same-trainer move. That's a wider blast radius than "only the affected session." Scope it down to fire only when the trainer actually changed.

## Task list (build in this order)

### 1. RPC: narrow the trainer-propagation side effect — ✅ DONE
- [x] In `move_scheduled_session_safely`, only run the "update allocation + sibling sessions" trainer-propagation block when `target_trainer_id is distinct from selected_session.trainer_id`.
- [x] Also fixed a related bug: a null `target_trainer_id` used to silently wipe the trainer from the allocation and every sibling session; it now leaves the trainer untouched when no real change is requested.
- [ ] Leave `schedule_allocation_session_safely` / `assign_scheduled_session_room_safely` as-is (already single-row) — **not yet verified**, do this next as part of Task 2.

### 2. New Quick Edit action, separate from the full editor — ✅ DONE
- [x] Added `src/features/timetable-quick-edit/actions.ts`: three single-field actions, each a thin wrapper around an existing safe RPC, no extra fetch before calling it.
- [x] Each action revalidates one path only (`/timetable/quick-edit`), never the 5-route `refreshEditor()` fan-out.
- [x] Trainer action deliberately still propagates to sibling sessions (that's the correct behavior per Task 1 — a real trainer change *should* update the allocation; only the redundant no-op case was removed).
- [x] `quickUndoLastChangeAction` added, ready for the success-toast "Undo" button in Task 5.
- [ ] Confirm the real route Quick Edit will live at and update `refreshQuickEdit()` to match (currently a placeholder path).

### 3. New Quick Edit query — single-session load — ✅ DONE
- [x] Added `getQuickEditData(sessionId, field)` in `src/features/timetable-quick-edit/queries.ts`: one PK lookup for the session's identity (cohort/unit/trainer/room names, current day/time labels) plus exactly one option list — `schedule` (working days + time slots for that period), `room` (active/available rooms), or `trainer` (active/available trainers) — matching whichever single field the Quick Edit panel is editing.
- [x] `room` and `trainer` variants fetch identity and options in parallel (2 concurrent requests); `schedule` needs the session's academic_period_id first, so it's sequential (still only 2 request stages total).
- [x] Does not call `getTimetableEditorData` or any institution-wide cohort/allocation/workload query.
- [ ] Wire this into the actual Quick Edit page/panel component — that's Task 5.

### 4. Trim the clash diagnostic
- [ ] In `diagnoseScheduleClash`, when called from Quick Edit, skip the "overlapping sessions for the whole day" scan; look up only the session that the RPC's error already implicates (trainer or room clash tells you which one directly — one query, not the whole-day set). Keep the current full version for the main editor if it's used there for bulk troubleshooting.

### 5. Minimal UI
- [ ] One panel: session identity (read-only) → field being changed → Save/Cancel.
- [ ] Conflict message = the RPC's own error string + one suggested action (see wording examples below). No extra explanatory copy.
- [ ] "Undo last change" button on the success toast, calling the existing `undo_last_timetable_session_change`.

### 6. Guardrails — do not touch
- [ ] Do not add a bypass/force flag anywhere in the RPCs.
- [ ] Do not let Quick Edit write to `class_sessions`, `timetable_versions`, or anything beyond `scheduled_sessions`.
- [ ] Locked/published sessions stay non-editable via Quick Edit, same as today.

## Wording reference (keep messages this short)
- `Trainer clash: J. Mwangi is teaching CHN 204 at this time. → Try 10:00–11:00 or a different trainer.`
- `Room clash: Lab 2 is booked. → Free rooms now: Lab 1, Rm 204, Rm 210.`
- `Cohort clash: Y2S1 already has NUT 301 then. → Pick another slot for this cohort.`

## Test checklist before merge
- [ ] Moving one session's time does not change `updated_at` on any other `scheduled_sessions` row.
- [ ] Moving one session's time with an unchanged trainer does not touch the parent `teaching_allocations.trainer_id` or sibling sessions.
- [ ] A Quick Edit save triggers exactly the scoped revalidation, not the 5-route fan-out (check network calls).
- [ ] Attendance (`class_sessions`) rows created before the move keep their original `session_date`/`starts_at`/`room_id`/`trainer_id` unchanged after the move.
- [ ] Locked session still rejected with the existing "Unlock this session before moving it." error.
- [ ] Undo restores the exact previous slot/room/trainer via `undo_last_timetable_session_change`.

## Open questions for the user (ask before building UI)
- Where should Quick Edit live — a button on each session card in the existing calendar view, or a separate lightweight page?
- Should Quick Edit be HOD-only (current `requireHodAccess` on all these RPCs), or should a subset of trainers get room-only self-service moves?
