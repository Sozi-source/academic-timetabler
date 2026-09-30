import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  getCourseOutlineContext,
  getLectureMaterialsForUnit,
} from '@/features/lecture-notes/queries';
import { LectureNotesWorkspace } from '@/features/lecture-notes/ui/lecture-notes-workspace';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ unitId: string }>;
}): Promise<Metadata> {
  const { unitId } = await params;
  const db = await createClient();
  const { data } = await db.from('units').select('code, name').eq('id', unitId).single();
  const unit = data as { code: string; name: string } | null;
  return {
    title: unit ? `Notes: ${unit.code} — ${unit.name}` : 'Lecture Notes Generator',
  };
}

export default async function UnitLectureNotesPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  await requireHodAccess();
  const { unitId } = await params;

  const db = await createClient();

  // Fetch unit info
  const { data: unit } = await db
    .from('units')
    .select('id, code, name')
    .eq('id', unitId)
    .single();

  if (!unit) notFound();
  const u = unit as { id: string; code: string; name: string };

  // Fetch active allocation for this unit (for context)
  const { data: allocation } = await db
    .from('teaching_allocations')
    .select('id, cohorts(name), academic_periods(name)')
    .eq('unit_id', unitId)
    .in('status', ['draft', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const alloc = (allocation as unknown) as {
    id: string;
    cohorts: { name: string } | null;
    academic_periods: { name: string } | null;
  } | null;

  // Parallel fetch: materials + course outline
  const [materials, outline] = await Promise.all([
    getLectureMaterialsForUnit(unitId),
    getCourseOutlineContext(unitId),
  ]);

  const topics = outline?.topics ?? [];

  return (
    <div className="admin-screen space-y-6">
      <PageHeader
        eyebrow={u.code}
        title={u.name}
        backHref="/lecture-notes"
        backLabel="Lecture Notes"
        context={
          alloc ? (
            <span className="text-xs text-text-muted">
              {alloc.cohorts?.name} · {alloc.academic_periods?.name}
            </span>
          ) : undefined
        }
        actions={
          <Badge variant="neutral">
            {materials.length} material{materials.length === 1 ? '' : 's'}
          </Badge>
        }
      />

      <LectureNotesWorkspace
        unitId={unitId}
        unitCode={u.code}
        unitName={u.name}
        teachingAllocationId={alloc?.id ?? null}
        initialMaterials={materials}
        topics={topics}
      />
    </div>
  );
}
