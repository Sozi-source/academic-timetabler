import { requireTrainerAccess } from '@/features/auth/authorization';
import { getAssessmentMilestones } from '@/features/teaching-documents/assessment-milestones';
import { createAdminClient } from '@/lib/supabase/admin';
import { OnlineCurriculumBuilder } from '@/features/teaching-documents/curriculum-editor/online-builder';

interface PageProps {
  searchParams: Promise<{ unitId?: string; unitCode?: string }>;
}

export default async function OnlineCurriculumEditorPage({ searchParams }: PageProps) {
  await requireTrainerAccess();
  const { unitId, unitCode } = await searchParams;

  const admin = createAdminClient();

  const [{ data: unitsData }, milestones, { data: existingVersions }] = await Promise.all([
    admin.from('units').select('id,code,name,is_active').order('code', { ascending: true }),
    getAssessmentMilestones(),
    admin.from('curriculum_document_versions').select('unit_id,payload').eq('status', 'active'),
  ]);

  let activeUnits = (unitsData ?? [])
    .filter((u) => u.is_active !== false)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((u) => ({
      id: u.id,
      code: u.code,
      name: u.name,
    }));

  if (activeUnits.length === 0) {
    activeUnits = (unitsData ?? []).map((u) => ({
      id: u.id,
      code: u.code,
      name: u.name,
    }));
  }

  // Resolve initial unit id from either unitId or unitCode param
  let resolvedUnitId = unitId;
  if (!resolvedUnitId && unitCode) {
    const cleanParamCode = unitCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched = activeUnits.find(
      (u) => u.code.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanParamCode
    );
    if (matched) {
      resolvedUnitId = matched.id;
    }
  }

  const existingCurriculumMap: Record<
    string,
    {
      unitDescription?: string;
      coreLearningOutcomes?: string;
      references?: string;
      topics: { topicTitle: string; subTopics: string[] }[];
    }
  > = {};

  if (existingVersions) {
    for (const v of existingVersions) {
      const p = (v as any).payload;
      if (p && v.unit_id) {
        const uCode = p.unit?.unitCode || '';
        const uName = p.unit?.unitName || '';
        const rawRef = p.unit?.referencesResources || '';
        const isBio = /biochem/i.test(uCode) || /biochem/i.test(uName);
        const cleanRef = !isBio && /lehninger|harper/i.test(rawRef) ? '' : rawRef;

        existingCurriculumMap[v.unit_id] = {
          unitDescription: p.unit?.unitDescription,
          coreLearningOutcomes: p.unit?.coreLearningOutcomes,
          references: cleanRef,
          topics: (p.content || []).map((c: any) => ({
            topicTitle: c.topic || '',
            subTopics: typeof c.coverage === 'string'
              ? c.coverage.split(/\s*[·;]\s*/).filter(Boolean)
              : Array.isArray(c.coverage)
              ? c.coverage
              : [],
          })),
        };
      }
    }
  }

  return (
    <OnlineCurriculumBuilder
      units={activeUnits}
      initialUnitId={resolvedUnitId}
      milestones={milestones}
      existingCurriculumMap={existingCurriculumMap}
    />
  );
}
