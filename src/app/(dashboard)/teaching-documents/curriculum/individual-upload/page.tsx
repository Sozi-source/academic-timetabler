import { requireTrainerAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  IndividualUploadForm,
  type SystemUnitOption,
} from '@/features/teaching-documents/individual-upload-form';
import {
  isCurriculumDocumentType,
  type CurriculumDocumentType,
} from '@/features/teaching-documents/curriculum-document-types';
import {
  normalizeUnitCodeKey,
  TVET_CURRICULUM_REGISTRY,
} from '@/features/teaching-documents/curriculum-registry';

interface PageProps {
  searchParams?: Promise<{
    unitId?: string;
    unitCode?: string;
    documentType?: string | string[];
  }>;
}

export default async function IndividualUploadPage({ searchParams }: PageProps) {
  const profile = await requireTrainerAccess();
  const resolvedParams = searchParams ? (await searchParams) ?? {} : {};
  const unitId = typeof resolvedParams.unitId === 'string' ? resolvedParams.unitId : undefined;
  const unitCode = typeof resolvedParams.unitCode === 'string' ? resolvedParams.unitCode : undefined;
  const rawDocType = resolvedParams.documentType;

  const docTypeStr = Array.isArray(rawDocType) ? rawDocType[0] : rawDocType;
  const initialDocumentType: CurriculumDocumentType = isCurriculumDocumentType(docTypeStr)
    ? docTypeStr
    : 'course_outline';

  let activeUnits: SystemUnitOption[] = [];

  if (profile.activeDepartmentId) {
    try {
      const admin = createAdminClient();
      const { data: unitsData } = await admin
        .from('units')
        .select('id, code, name, is_active')
        .eq('department_id', profile.activeDepartmentId)
        .order('code', { ascending: true });

      activeUnits = (unitsData ?? [])
        .filter((u) => u.is_active !== false && Boolean(u.code))
        .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
        .map((u) => ({
          id: u.id,
          code: u.code || '',
          name: u.name || u.code || '',
        }));
    } catch {
      activeUnits = [];
    }
  }

  // Fallback to curriculum registry entries if department has no loaded units yet
  if (activeUnits.length === 0) {
    const seenCodes = new Set<string>();
    const regUnits: SystemUnitOption[] = [];
    for (const [codeKey, meta] of Object.entries(TVET_CURRICULUM_REGISTRY)) {
      const uCode = (meta?.unitCode || codeKey).trim().toUpperCase();
      if (!seenCodes.has(uCode)) {
        seenCodes.add(uCode);
        regUnits.push({
          id: `reg-${normalizeUnitCodeKey(uCode)}`,
          code: uCode,
          name: meta?.unitName || uCode,
        });
      }
    }
    activeUnits = regUnits;
  }

  // Match unitId from unitCode if unitId wasn't passed directly
  let resolvedUnitId = unitId;
  if (!resolvedUnitId && unitCode) {
    const matched = activeUnits.find(
      (u) => (u.code || '').toLowerCase() === unitCode.toLowerCase()
    );
    if (matched) {
      resolvedUnitId = matched.id;
    }
  }

  return (
    <IndividualUploadForm
      units={activeUnits}
      initialUnitId={resolvedUnitId}
      initialDocumentType={initialDocumentType}
    />
  );
}
