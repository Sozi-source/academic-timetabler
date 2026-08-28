export interface UnitEquivalenceCandidate {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  programme_id: string;
  programme_code: string;
  programme_name: string;
  canonical_name: string;
  exact_group_size: number;
  nearest_unit_id: string | null;
  nearest_unit_name: string | null;
  similarity_score: number;
  equivalence_group_id: string | null;
}

export interface UnitEquivalenceGroup {
  id: string;
  canonical_name: string;
  status: string;
  members: Array<{
    unit_id: string;
    units: { code: string; name: string; programmes: { code: string; name: string } | null } | null;
  }>;
}
