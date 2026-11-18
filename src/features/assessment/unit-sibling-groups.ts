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

  return {
    siblingsOf: (unitId) => [...(links.get(unitId) ?? [])],
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
