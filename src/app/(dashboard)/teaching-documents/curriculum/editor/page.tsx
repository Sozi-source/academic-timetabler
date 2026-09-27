import { requireTrainerAccess } from '@/features/auth/authorization';
import { getAssessmentMilestones } from '@/features/teaching-documents/assessment-milestones';
import { createAdminClient } from '@/lib/supabase/admin';
import { OnlineCurriculumBuilder } from '@/features/teaching-documents/curriculum-editor/online-builder';
import { isCurriculumDocumentType } from '@/features/teaching-documents/curriculum-document-types';

interface PageProps {
  searchParams: Promise<{
    unitId?: string;
    unitCode?: string;
    documentType?: string | string[];
  }>;
}

export default async function OnlineCurriculumEditorPage({ searchParams }: PageProps) {
  const profile = await requireTrainerAccess();
  const { unitId, unitCode, documentType: requestedDocumentType } = await searchParams;
  const initialDocumentType = isCurriculumDocumentType(requestedDocumentType)
    ? requestedDocumentType
    : 'course_outline';

  if (!profile.activeDepartmentId) {
    return (
      <OnlineCurriculumBuilder
        units={[]}
        initialUnitId={unitId}
        initialDocumentType={initialDocumentType}
        milestones={await getAssessmentMilestones()}
        existingCurriculumMap={{}}
      />
    );
  }

  const admin = createAdminClient();

  const [{ data: unitsData }, milestones, { data: existingVersions }] = await Promise.all([
    admin
      .from('units')
      .select('id,code,name,is_active')
      .eq('department_id', profile.activeDepartmentId)
      .order('code', { ascending: true }),
    getAssessmentMilestones(),
    admin
      .from('curriculum_document_versions')
      .select('unit_id,document_type,payload')
      .eq('department_id', profile.activeDepartmentId)
      .eq('status', 'active')
      .in('document_type', ['course_outline', 'scheme_of_work']),
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
      if (!isCurriculumDocumentType(v.document_type)) continue;
      const p = (v as any).payload;
      if (p && v.unit_id) {
        const uCode = p.unit?.unitCode || '';
        const uName = p.unit?.unitName || '';
        const rawRef = p.unit?.referencesResources || '';
        const isBio = /biochem/i.test(uCode) || /biochem/i.test(uName);
        const cleanRef = !isBio && /lehninger|harper/i.test(rawRef) ? '' : rawRef;

        existingCurriculumMap[`${v.document_type}:${v.unit_id}`] = {
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
      initialDocumentType={initialDocumentType}
      milestones={milestones}
      existingCurriculumMap={existingCurriculumMap}
    />
  );
}
