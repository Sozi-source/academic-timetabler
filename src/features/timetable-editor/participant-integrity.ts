import 'server-only';

import type { createClient } from '@/lib/supabase/server';

type TimetableSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Shared-class membership is denormalised into `participant_cohort_ids` on both
 * `teaching_allocations` and `scheduled_sessions`. Those arrays drift whenever a cohort
 * drops, withdraws or is excluded from a unit offering, and a stale entry makes the
 * timetable editor block a placement because a cohort "already has" a unit it does not take.
 *
 * This module mirrors, in TypeScript, the authoritative resolution now implemented by
 * `public.resolve_participant_cohort_ids`: a partner cohort counts only while it still holds
 * an approved, included, timetable-enabled unit offering for its own equivalent unit. Cohorts
 * with no unit offerings at all in the period are not managed by the offerings module, so
 * their historical membership is preserved.
 */

const LIVE_OFFERING_STATUSES = new Set(['draft', 'active']);

export interface ParticipantResolver {
  /** Cohorts that genuinely share the given teaching offering, primary cohort included. */
  resolve(primaryCohortId: string, teachingOfferingId: string | null): Set<string>;
  /** Live subset of an already-stored participant array (never widens it). */
  sanitize(
    primaryCohortId: string,
    teachingOfferingId: string | null,
    storedCohortIds: readonly string[],
  ): string[];
  /** Teaching offering that owns an allocation, if any. */
  offeringIdForAllocation(allocationId: string): string | null;
}

interface UnitOfferingRow {
  cohort_id: string;
  unit_id: string;
  status: string;
  is_timetable_enabled: boolean;
  approval_status: string;
  selection_state: string;
}

interface OfferingParticipantRow {
  teaching_offering_id: string;
  cohort_id: string;
  unit_id: string;
}

interface AllocationOfferingRow {
  id: string;
  teaching_offering_id: string | null;
}

function offeringKey(cohortId: string, unitId: string): string {
  return `${cohortId}:${unitId}`;
}

export function createParticipantResolver(input: {
  unitOfferings: UnitOfferingRow[];
  offeringParticipants: OfferingParticipantRow[];
  allocations: AllocationOfferingRow[];
}): ParticipantResolver {
  const liveOfferingKeys = new Set<string>();
  const managedCohortIds = new Set<string>();

  for (const offering of input.unitOfferings) {
    managedCohortIds.add(offering.cohort_id);
    if (
      LIVE_OFFERING_STATUSES.has(offering.status)
      && offering.is_timetable_enabled
      && offering.approval_status === 'approved'
      && offering.selection_state === 'included'
    ) {
      liveOfferingKeys.add(offeringKey(offering.cohort_id, offering.unit_id));
    }
  }

  const participantsByOffering = new Map<string, OfferingParticipantRow[]>();
  for (const participant of input.offeringParticipants) {
    const existing = participantsByOffering.get(participant.teaching_offering_id);
    if (existing) {
      existing.push(participant);
    } else {
      participantsByOffering.set(participant.teaching_offering_id, [participant]);
    }
  }

  const offeringByAllocation = new Map<string, string | null>(
    input.allocations.map((allocation) => [allocation.id, allocation.teaching_offering_id]),
  );

  const resolvedCache = new Map<string, Set<string>>();

  function resolve(primaryCohortId: string, teachingOfferingId: string | null): Set<string> {
    const cacheKey = `${teachingOfferingId ?? 'none'}:${primaryCohortId}`;
    const cached = resolvedCache.get(cacheKey);
    if (cached) return cached;

    const live = new Set<string>([primaryCohortId]);
    const participants = teachingOfferingId
      ? participantsByOffering.get(teachingOfferingId) ?? []
      : [];

    for (const participant of participants) {
      const isLive = liveOfferingKeys.has(offeringKey(participant.cohort_id, participant.unit_id));
      const isUnmanaged = !managedCohortIds.has(participant.cohort_id);
      if (isLive || isUnmanaged) {
        live.add(participant.cohort_id);
      }
    }

    resolvedCache.set(cacheKey, live);
    return live;
  }

  return {
    resolve,
    sanitize(primaryCohortId, teachingOfferingId, storedCohortIds) {
      // No offering context at all (manual or legacy session): trust what is stored.
      if (!teachingOfferingId) {
        return Array.from(new Set([...storedCohortIds, primaryCohortId]));
      }
      const live = resolve(primaryCohortId, teachingOfferingId);
      const sanitized = storedCohortIds.filter(
        (id) => id === primaryCohortId || live.has(id),
      );
      return Array.from(new Set([primaryCohortId, ...sanitized]));
    },
    offeringIdForAllocation(allocationId) {
      return offeringByAllocation.get(allocationId) ?? null;
    },
  };
}

/** Loads everything the resolver needs for one academic period. */
export async function loadParticipantResolver(
  supabase: TimetableSupabaseClient,
  academicPeriodId: string,
): Promise<ParticipantResolver> {
  const [allocationResult, participantResult, unitOfferingResult] = await Promise.all([
    supabase
      .from('teaching_allocations')
      .select('id, teaching_offering_id')
      .eq('academic_period_id', academicPeriodId),
    supabase
      .from('teaching_offering_participants')
      .select('teaching_offering_id, cohort_id, unit_id, teaching_offerings!inner ( academic_period_id )')
      .eq('teaching_offerings.academic_period_id', academicPeriodId),
    supabase
      .from('unit_offerings')
      .select('cohort_id, unit_id, status, is_timetable_enabled, approval_status, selection_state')
      .eq('academic_period_id', academicPeriodId),
  ]);

  return createParticipantResolver({
    allocations: (allocationResult.data ?? []) as AllocationOfferingRow[],
    offeringParticipants: (participantResult.data ?? []) as unknown as OfferingParticipantRow[],
    unitOfferings: (unitOfferingResult.data ?? []) as UnitOfferingRow[],
  });
}
