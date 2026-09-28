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
  getAllCurriculumUnits,
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

  // 1. Fetch DB units for active department
  let dbUnits: SystemUnitOption[] = [];
  if (profile.activeDepartmentId) {
    try {
      const admin = createAdminClient();
      const { data: unitsData } = await admin
        .from('units')
        .select('id, code, name, is_active')
        .eq('department_id', profile.activeDepartmentId)
        .order('code', { ascending: true });

      dbUnits = (unitsData ?? [])
        .filter((u) => u.is_active !== false && Boolean(u.code))
        .map((u) => ({
          id: u.id,
          code: (u.code || '').trim().toUpperCase(),
          name: (u.name || u.code || '').trim(),
        }));
    } catch {
      dbUnits = [];
    }
  }

  // 2. Master curriculum registry units (guarantees all 43 TVET department units are always available)
  const canonicalUnits: SystemUnitOption[] = getAllCurriculumUnits().map((u) => ({
    id: `canonical-${u.canonicalKey}`,
    code: u.unitCode.trim().toUpperCase(),
    name: u.unitName.trim(),
  }));

  // 3. Merge: DB units take priority, add canonical units if not already in DB
  const seenCodes = new Set<string>();
  const activeUnits: SystemUnitOption[] = [];

  for (const u of dbUnits) {
    const key = normalizeUnitCodeKey(u.code);
    if (!seenCodes.has(key)) {
      seenCodes.add(key);
      activeUnits.push(u);
    }
  }

  for (const u of canonicalUnits) {
    const key = normalizeUnitCodeKey(u.code);
    if (!seenCodes.has(key)) {
      seenCodes.add(key);
      activeUnits.push(u);
    }
  }

  activeUnits.sort((a, b) => a.code.localeCompare(b.code));

  // 4. Resolve initial unit selection if unitId or unitCode was provided
  let resolvedUnitId = unitId;
  if (!resolvedUnitId && unitCode) {
    const matched = activeUnits.find(
      (u) => normalizeUnitCodeKey(u.code) === normalizeUnitCodeKey(unitCode)
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
