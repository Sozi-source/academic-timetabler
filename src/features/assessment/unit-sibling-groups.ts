/**
 * Shared / equivalent unit sibling resolution.
 *
 * Marks for shared classes (e.g. CND 1205 taught jointly with DHN 1303) are
 * entered once against a single "root" assessment event, while every
 * participating unit keeps its own assessment event and population. These helpers
 * mirror the sibling definition used by the submission RPC
 * (`save_assessment_online_component_marks`): events are siblings when their
 * units share a confirmed shared offering or belong to the same approved
 * unit-equivalence group. Sibling resolution is intentionally NOT transitive.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface SharedOfferingLink {
  unit_id: string | null;
  confirmed_shared_offering_id: string | null;
}

export interface EquivalenceMemberLink {
  unit_id: string | null;
  equivalence_group_id: string | null;
}

export interface UnitSiblingResolver {
  /** Units that share a class with `unitId` (never includes `unitId`). */
  siblingsOf(unitId: string): string[];
  /**
   * Canonical key for the shared/equivalent class component containing `unitId`.
   * Any two units in the same shared/equivalent class produce the same key.
   */
  groupKeyOf(unitId: string): string;
}

export function buildUnitSiblingResolver(
  offerings: SharedOfferingLink[],
  equivalenceMembers: EquivalenceMemberLink[],
): UnitSiblingResolver {
  const links = new Map<string, Set<string>>();

  const linkAll = (unitIds: string[]) => {
    for (const a of unitIds) {
      for (const b of unitIds) {
        if (a === b) continue;
        let set = links.get(a);
        if (!set) {
          set = new Set<string>();
          links.set(a, set);
        }
        set.add(b);
      }
    }
  };

  const bucket = <T extends { unit_id: string | null }>(
    rows: T[],
    key: (row: T) => string | null,
  ) => {
    const groups = new Map<string, Set<string>>();
    for (const row of rows) {
      const groupKey = key(row);
      if (!groupKey || !row.unit_id) continue;
      let set = groups.get(groupKey);
      if (!set) {
        set = new Set<string>();
        groups.set(groupKey, set);
      }
      set.add(row.unit_id);
    }
    return groups.values();
  };

  for (const group of bucket(offerings, (row) => row.confirmed_shared_offering_id)) {
    linkAll([...group]);
  }
  for (const group of bucket(equivalenceMembers, (row) => row.equivalence_group_id)) {
    linkAll([...group]);
  }

  // Compute deterministic connected-component canonical keys for deduplication
  const componentKey = new Map<string, string>();
  const visited = new Set<string>();
  for (const startId of links.keys()) {
    if (visited.has(startId)) continue;
    const queue = [startId];
    const members: string[] = [];
    visited.add(startId);
    while (queue.length > 0) {
      const current = queue.shift()!;
      members.push(current);
      for (const next of links.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    members.sort();
    const canonical = members[0];
    for (const member of members) {
      componentKey.set(member, canonical);
    }
  }

  return {
    siblingsOf: (unitId) => [...(links.get(unitId) ?? [])],
    groupKeyOf: (unitId) => componentKey.get(unitId) ?? unitId,
  };
}

/** Loads the sibling resolver for an academic period using an admin/service client. */
export async function loadUnitSiblingResolver(
  admin: SupabaseClient,
  academicPeriodId: string,
): Promise<UnitSiblingResolver> {
  const [offerings, equivalence] = await Promise.all([
    admin
      .from('unit_offerings')
      .select('unit_id, confirmed_shared_offering_id')
      .eq('academic_period_id', academicPeriodId)
      .not('confirmed_shared_offering_id', 'is', null),
    admin
      .from('unit_equivalence_members')
      .select('unit_id, equivalence_group_id')
      .eq('status', 'approved'),
  ]);

  return buildUnitSiblingResolver(
    (offerings.data ?? []) as SharedOfferingLink[],
    (equivalence.data ?? []) as EquivalenceMemberLink[],
  );
}

/**
 * Resolves the set of student IDs holding an active `'registered'` registration
 * for any of `unitIds` or their shared/equivalent siblings in `academicPeriodId`
 * (including active individual class assignments backed by a registered unit).
 */
export async function loadRegisteredStudentIdsForUnits(
  admin: SupabaseClient,
  academicPeriodId: string,
  unitIds: string[],
  candidateStudentIds?: string[],
): Promise<Set<string>> {
  const uniqueUnits = [...new Set(unitIds.filter(Boolean))];
  if (!academicPeriodId || uniqueUnits.length === 0) {
    return new Set();
  }
  if (candidateStudentIds && candidateStudentIds.length === 0) {
    return new Set();
  }

  const siblingResolver = await loadUnitSiblingResolver(admin, academicPeriodId);
  const allUnitIds = [
    ...new Set([
      ...uniqueUnits,
      ...uniqueUnits.flatMap((unitId) => siblingResolver.siblingsOf(unitId)),
    ]),
  ];

  const registeredIds = new Set<string>();
  const PAGE_SIZE = 1000;

  if (candidateStudentIds && candidateStudentIds.length > 0) {
    const CHUNK_SIZE = 200;
    for (let i = 0; i < candidateStudentIds.length; i += CHUNK_SIZE) {
      const chunk = candidateStudentIds.slice(i, i + CHUNK_SIZE);
      const { data, error } = await admin
        .from('student_unit_registrations')
        .select('student_id')
        .eq('academic_period_id', academicPeriodId)
        .eq('registration_status', 'registered')
        .in('unit_id', allUnitIds)
        .in('student_id', chunk);

      if (error) {
        throw new Error(`Unable to verify unit registrations: ${error.message}`);
      }
      for (const row of data ?? []) {
        if (row.student_id) registeredIds.add(String(row.student_id));
      }
    }
  } else {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from('student_unit_registrations')
        .select('student_id')
        .eq('academic_period_id', academicPeriodId)
        .eq('registration_status', 'registered')
        .in('unit_id', allUnitIds)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Unable to verify unit registrations: ${error.message}`);
      }
      const page = data ?? [];
      for (const row of page) {
        if (row.student_id) registeredIds.add(String(row.student_id));
      }
      if (page.length < PAGE_SIZE) break;
    }
  }

  // Also include active transfer / individual class assignments backed by a registered source unit
  const { data: allocations } = await admin
    .from('teaching_allocations')
    .select('id')
    .eq('academic_period_id', academicPeriodId)
    .in('unit_id', allUnitIds);

  const allocIds = (allocations ?? []).map((a) => a.id).filter(Boolean);
  if (allocIds.length > 0) {
    const { data: assignments } = await admin
      .from('student_class_assignments')
      .select('student_id, student_unit_registrations!inner(registration_status)')
      .eq('academic_period_id', academicPeriodId)
      .eq('is_active', true)
      .in('teaching_allocation_id', allocIds);

    for (const assignment of assignments ?? []) {
      const reg = Array.isArray(assignment.student_unit_registrations)
        ? assignment.student_unit_registrations[0]
        : assignment.student_unit_registrations;
      if (assignment.student_id && reg?.registration_status === 'registered') {
        registeredIds.add(String(assignment.student_id));
      }
    }
  }

  return registeredIds;
}
