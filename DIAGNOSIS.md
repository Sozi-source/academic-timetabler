# Phantom "Cohort Conflict" — diagnosis and fix

## What you were seeing
Placing **Agriculture** for `CHN-JAN-MAR-2025` was refused because that cohort "already has"
`CHN 2207 Introduction to Nutrition Assessment and Surveillance`; placing **Industrial Organization**
for `DHN-MAY-2024` on Tuesday 10:30 was refused because of `DHN 3104 Diet Therapy III`.
Neither cohort takes the blocking unit.

## Root cause
Shared-class membership is denormalised into two arrays:

* `teaching_allocations.participant_cohort_ids`
* `scheduled_sessions.participant_cohort_ids`

Conflict detection (the DB trigger, the placement RPC, and the live check in the dialog) trusts
those arrays. Two things kept them wrong:

1. **No propagation.** `refresh_shared_class_participant_context()` was only ever called by hand
   inside one-off migrations. There was no trigger on `teaching_offering_participants` and none on
   `unit_offerings` status changes, so dropping, withdrawing or excluding a cohort from a unit left
   that cohort inside every already-placed session's participant array — forever.
2. **No authority check.** `resolve_participant_cohort_ids()` returned *every*
   `teaching_offering_participants` row for an offering, with no check that the cohort still holds a
   live unit offering for its own equivalent unit.

So a cohort that once shared (or was mistakenly imported into) a class keeps blocking every new
placement at that slot. The earlier DNDT / CHN-MAY-2025 / DND-SEP-2025 "correct participants"
migrations were per-cohort symptom repairs of this same defect.

Three smaller defects in the same path:

* The clash message named the **owning** cohort of the blocking session, not the cohort that
  actually overlapped — which is why the text described a cohort/unit pairing that doesn't exist.
* Phantom participants inflate `combined_cohort_size`, which can falsely trip the room-capacity
  guard ("Room capacity (60) is below cohort size (…)").
* In the placement dialog, unchecking **Hard-fix / Lock this session immediately** submitted
  nothing, and the action re-defaulted it to `true` — the session locked anyway.

## The fix
`supabase/migrations/20260919160000_authoritative_participant_cohort_conflicts.sql`

1. `cohort_has_live_unit_offering()` / `cohort_offerings_are_managed()` — authoritative membership
   predicates (`status in (draft,active)`, `is_timetable_enabled`, `approval_status = approved`,
   `selection_state = included`), the same gate `getTimetableEnabledAllocations` already uses.
2. `resolve_participant_cohort_ids()` filters participants through them. Cohorts with *no* unit
   offerings at all in the period are treated as unmanaged (legacy/manual shared classes) and keep
   their membership — deliberately conservative so no working shared class is dissolved.
3. Triggers on `teaching_offering_participants` and `unit_offerings` refresh membership
   automatically. Both swallow refresh failures as warnings so a sync problem can never block the
   drop or approval that triggered it.
4. A one-off repair of the drifted data. **Shrink-only by construction** — allocations are rewritten
   only when the new set is a subset of the stored set, sessions are intersected with live
   membership — so deliberate standalone/subset placements survive and the repair cannot create a
   new conflict.
5. Clash messages now name the cohort that genuinely overlaps and add "That session is a shared
   class led by X" when the owner differs.
6. `audit_phantom_session_participants(academic_period_id)` for verification and monitoring.

Application side:

* `src/features/timetable-editor/participant-integrity.ts` (new) mirrors the SQL resolution in
  TypeScript, so the editor's live pre-flight check stops trusting stale arrays even before the
  migration is deployed. `sanitize()` never widens a stored set.
* `queries.ts` sanitizes both session participants and unplaced-allocation participants.
* `actions.ts` — `diagnoseScheduleClash` resolves both sides through the resolver and reports the
  shared-class owner.
* `schedule-allocation-dialog.tsx` — clash panel names the owning cohort; lock state is submitted
  via a hidden field.

## Verify (run these against the live DB)

Before the migration, confirm the phantom membership for the exact reported case:

```sql
-- Which sessions list CHN-JAN-MAR-2025 as a participant, and for which units?
select s.id, u.code as unit_code, u.name, owner.code as owner_cohort,
       d.day_of_week, ts.starts_at, s.participant_cohort_ids
from public.scheduled_sessions s
join public.units u on u.id = s.unit_id
join public.cohorts owner on owner.id = s.cohort_id
join public.working_days d on d.id = s.working_day_id
join public.time_slots ts on ts.id = s.start_time_slot_id
where (select id from public.cohorts where code = 'CHN-JAN-MAR-2025')
      = any(array_append(coalesce(s.participant_cohort_ids,'{}'::uuid[]), s.cohort_id))
order by d.sequence_number, ts.starts_at;

-- Does that cohort actually hold a live offering for the blocking unit?
select uo.status, uo.approval_status, uo.selection_state, uo.is_timetable_enabled
from public.unit_offerings uo
join public.cohorts c on c.id = uo.cohort_id
join public.units u on u.id = uo.unit_id
where c.code = 'CHN-JAN-MAR-2025' and u.code = 'CHN 2207';
```

After `supabase db push`:

```sql
select * from public.audit_phantom_session_participants('<academic_period_id>');  -- expect 0 rows
```

Then reopen **Place Unit on Timetable** for both reported cases — the panel should read
"Slot is completely available for all cohorts, trainer, and room."

## Before merging
This environment has no installed `node_modules`, so the TypeScript was parse-checked with esbuild
and reviewed manually rather than compiled, and the SQL could not be executed. Run
`npm run check` and `npm test`, then apply the migration on staging before production.
