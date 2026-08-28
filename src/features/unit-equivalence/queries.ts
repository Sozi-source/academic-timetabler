import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { UnitEquivalenceCandidate, UnitEquivalenceGroup } from './types';

export async function getUnitEquivalenceWorkspace() {
  const db = await createClient();
  const [candidateResult, groupResult] = await Promise.all([
    db.rpc('get_unit_equivalence_candidates'),
    db.from('unit_equivalence_groups').select(`
      id, canonical_name, status,
      members:unit_equivalence_members(unit_id, units(code, name, programmes(code, name)))
    `).eq('status', 'active').order('canonical_name'),
  ]);
  if (candidateResult.error) throw new Error(`Unable to map unit similarity: ${candidateResult.error.message}`);
  if (groupResult.error) throw new Error(`Unable to load approved equivalence groups: ${groupResult.error.message}`);
  return {
    candidates: (candidateResult.data ?? []) as UnitEquivalenceCandidate[],
    groups: (groupResult.data ?? []) as unknown as UnitEquivalenceGroup[],
  };
}
