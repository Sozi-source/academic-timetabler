import { notFound, redirect } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

interface PageProps {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ periodId?: string | string[]; cohortId?: string | string[] }>;
}

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function AssessmentUnitPage({ params, searchParams }: PageProps) {
  const profile = await requireHodAccess();
  const [{ unitId }, query] = await Promise.all([params, searchParams]);
  if (!profile.activeDepartmentId) notFound();

  const admin = createAdminClient();

  // Resolve periodId: from query or active period
  let periodId = typeof query.periodId === 'string' ? query.periodId : null;
  if (!periodId) {
    const { data: activePeriod } = await admin
      .from('academic_periods')
      .select('id')
      .order('starts_on', { ascending: false })
      .limit(1)
      .maybeSingle();
    periodId = activePeriod?.id ?? null;
  }
  if (!periodId) notFound();

  // Resolve equivalent unit IDs if unit belongs to an approved equivalence group
  const { data: equivalenceRows, error: equivalenceError } = await admin
    .from('unit_equivalence_members')
    .select('equivalence_group_id,group:unit_equivalence_groups!inner(id,canonical_name,status,department_id)')
    .eq('unit_id', unitId)
    .eq('status', 'approved');
  if (equivalenceError) throw new Error('Unable to load approved unit equivalences.');

  const approvedGroup = (equivalenceRows ?? []).map((row) => ({
    id: row.equivalence_group_id,
    group: one(row.group as Relation<{ id: string; canonical_name: string; status: string; department_id: string | null }>),
  })).find(({ group }) => group?.status === 'active' && (!group.department_id || group.department_id === profile.activeDepartmentId));

  let equivalentUnitIds = [unitId];
  if (approvedGroup?.group) {
    const { data: members, error: membersError } = await admin
      .from('unit_equivalence_members')
      .select('unit_id,unit:units!inner(programme:programmes!inner(department_id))')
      .eq('equivalence_group_id', approvedGroup.id)
      .eq('status', 'approved')
      .eq('unit.programme.department_id', profile.activeDepartmentId);
    if (membersError) throw new Error('Unable to load equivalent unit members.');
    equivalentUnitIds = [...new Set((members ?? []).map((member) => member.unit_id))];
  }

  // Find markbook assessment events for this unit offering
  const { data: events } = await admin
    .from('assessment_events')
    .select('id,unit_id,cohort_id,assessment_type,title')
    .eq('department_id', profile.activeDepartmentId)
    .eq('academic_period_id', periodId)
    .in('unit_id', equivalentUnitIds)
    .order('created_at', { ascending: true });

  let targetEventId = events?.[0]?.id ?? null;

  // If markbook event is not yet provisioned, initialize it
  if (!targetEventId) {
    const { data: provisionedId } = await admin.rpc('ensure_unit_markbook_ready', {
      p_academic_period_id: periodId,
      p_unit_id: unitId,
    });
    if (provisionedId) {
      targetEventId = provisionedId as string;
    }
  }

  const cohortQuery = typeof query.cohortId === 'string' && query.cohortId
    ? `?cohortId=${encodeURIComponent(query.cohortId)}`
    : '';

  if (targetEventId) {
    redirect(`/assessment/marks/${targetEventId}${cohortQuery}`);
  }

  // Fallback to main assessment dashboard if no markbook could be resolved
  redirect(`/assessment?periodId=${encodeURIComponent(periodId)}`);
}
