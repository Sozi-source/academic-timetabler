import 'server-only';

import ExcelJS from 'exceljs';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

import { createZipArchive } from './zip-archive';

const qaDocumentTypes = ['course_outline', 'scheme_of_work'] as const;
type QaDocumentType = (typeof qaDocumentTypes)[number];

type UnitRow = { id: string; code: string; name: string };
type PeriodRow = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
};
type AllocationRow = {
  id: string;
  academic_period_id: string;
  cohort_id: string;
  unit_id: string;
  trainer_id: string;
};
type DocumentRow = {
  id: string;
  allocation_id: string;
  document_type: QaDocumentType;
  version_number: number | string;
  approved_revision_number: number | string | null;
  approved_at: string | null;
};
type RevisionRow = {
  document_id: string;
  revision_number: number | string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
};
type TrainerRow = { id: string; staff_number: string; full_name: string };
type CohortRow = { id: string; name: string };
type QaLine = {
  allocationId: string;
  trainerId: string;
  staffNumber: string;
  trainerName: string;
  cohortName: string;
  unitCode: string;
  unitName: string;
  documentType: QaDocumentType;
  version: number | null;
  approvedAt: string | null;
  status: string;
  filePath: string;
  buffer?: Buffer;
};

const MAX_ARCHIVE_INPUT_BYTES = 200 * 1024 * 1024;

function rows<T>(data: unknown, error: { message: string } | null, label: string): T[] {
  if (error) throw new Error(`Unable to load ${label}: ${error.message}`);
  return (data ?? []) as T[];
}

function safePathSegment(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 90);
  return normalized || 'Unknown';
}

function fileExtension(fileName: string): string {
  const match = fileName.match(/\.(docx|xlsx|pdf)$/i);
  return match?.[1]?.toLowerCase() ?? 'bin';
}

function documentLabel(type: QaDocumentType): string {
  return type === 'course_outline' ? 'Course Outline' : 'Scheme of Work';
}

async function loadDepartmentUnits(departmentId: string): Promise<UnitRow[]> {
  const admin = createAdminClient();
  const result = await admin
    .from('units')
    .select('id,code,name')
    .eq('department_id', departmentId);
  return rows<UnitRow>(result.data, result.error, 'department units');
}

export async function getQaExportPageData(): Promise<{
  departmentName: string;
  departmentSelected: boolean;
  periods: Array<{
    id: string;
    name: string;
    startsOn: string;
    endsOn: string;
    trainerCount: number;
    allocationCount: number;
    approvedDocuments: number;
    expectedDocuments: number;
  }>;
}> {
  const profile = await requireHodAccess();
  const departmentId = profile.activeDepartmentId;
  if (!departmentId) {
    return { departmentName: profile.departmentName, departmentSelected: false, periods: [] };
  }

  const admin = createAdminClient();
  const units = await loadDepartmentUnits(departmentId);
  if (units.length === 0) {
    return { departmentName: profile.departmentName, departmentSelected: true, periods: [] };
  }

  const allocationsResult = await admin
    .from('teaching_allocations')
    .select('id,academic_period_id,trainer_id,unit_id')
    .in('unit_id', units.map((unit) => unit.id))
    .in('status', ['active', 'completed', 'archived']);
  const allocations = rows<AllocationRow>(allocationsResult.data, allocationsResult.error, 'teaching allocations');
  if (allocations.length === 0) {
    return { departmentName: profile.departmentName, departmentSelected: true, periods: [] };
  }

  const allocationIds = allocations.map((allocation) => allocation.id);
  const periodIds = [...new Set(allocations.map((allocation) => allocation.academic_period_id))];
  const [periodResult, documentsResult] = await Promise.all([
    admin.from('academic_periods').select('id,name,starts_on,ends_on').in('id', periodIds),
    admin
      .from('teaching_documents')
      .select('id,allocation_id,document_type,version_number,approved_revision_number,approved_at,status')
      .in('allocation_id', allocationIds)
      .in('document_type', [...qaDocumentTypes])
      .eq('status', 'approved'),
  ]);
  const periods = rows<PeriodRow>(periodResult.data, periodResult.error, 'academic periods');
  const approvedDocuments = rows<DocumentRow>(documentsResult.data, documentsResult.error, 'approved teaching documents');
  const allocationById = new Map(allocations.map((allocation) => [allocation.id, allocation]));
  const documentsByPeriod = new Map<string, DocumentRow[]>();

  for (const document of approvedDocuments) {
    const allocation = allocationById.get(document.allocation_id);
    if (!allocation) continue;
    const current = documentsByPeriod.get(allocation.academic_period_id) ?? [];
    current.push(document);
    documentsByPeriod.set(allocation.academic_period_id, current);
  }

  return {
    departmentName: profile.departmentName,
    departmentSelected: true,
    periods: periods
      .map((period) => {
        const periodAllocations = allocations.filter((allocation) => allocation.academic_period_id === period.id);
        const trainerIds = new Set(periodAllocations.map((allocation) => allocation.trainer_id));
        const periodDocuments = documentsByPeriod.get(period.id) ?? [];
        const latestDocuments = new Map<string, DocumentRow>();
        for (const document of periodDocuments) {
          const key = `${document.allocation_id}:${document.document_type}`;
          const existing = latestDocuments.get(key);
          if (!existing || Number(document.version_number) > Number(existing.version_number)) {
            latestDocuments.set(key, document);
          }
        }
        return {
          id: period.id,
          name: period.name,
          startsOn: period.starts_on,
          endsOn: period.ends_on,
          trainerCount: trainerIds.size,
          allocationCount: periodAllocations.length,
          approvedDocuments: latestDocuments.size,
          expectedDocuments: periodAllocations.length * qaDocumentTypes.length,
        };
      })
      .sort((left, right) => right.startsOn.localeCompare(left.startsOn)),
  };
}

export async function createQaExaminationPack(
  periodId: string,
  departmentId: string,
  departmentName: string,
): Promise<{
  fileName: string;
  archive: Buffer;
  includedDocuments: number;
  unavailableDocuments: number;
}> {
  const admin = createAdminClient();
  const [units, periodResult] = await Promise.all([
    loadDepartmentUnits(departmentId),
    admin.from('academic_periods').select('id,name,starts_on,ends_on').eq('id', periodId).maybeSingle(),
  ]);
  const period = periodResult.data as PeriodRow | null;
  if (periodResult.error) throw new Error(`Unable to load the academic period: ${periodResult.error.message}`);
  if (!period) throw new Error('The selected academic period was not found.');
  if (units.length === 0) throw new Error('No units are available for the active department.');

  const allocationsResult = await admin
    .from('teaching_allocations')
    .select('id,academic_period_id,trainer_id,unit_id,cohort_id')
    .eq('academic_period_id', periodId)
    .in('unit_id', units.map((unit) => unit.id))
    .in('status', ['active', 'completed', 'archived']);
  const allocations = rows<AllocationRow>(allocationsResult.data, allocationsResult.error, 'period allocations');
  if (allocations.length === 0) throw new Error('There are no active or completed trainer allocations for this period.');

  const allocationIds = allocations.map((allocation) => allocation.id);
  const documentResult = await admin
    .from('teaching_documents')
    .select('id,allocation_id,document_type,version_number,approved_revision_number,approved_at,status')
    .in('allocation_id', allocationIds)
    .in('document_type', [...qaDocumentTypes])
    .eq('status', 'approved');
  const allDocuments = rows<DocumentRow>(documentResult.data, documentResult.error, 'approved teaching documents');
  const latestByKey = new Map<string, DocumentRow>();
  for (const document of allDocuments) {
    const key = `${document.allocation_id}:${document.document_type}`;
    const existing = latestByKey.get(key);
    if (!existing || Number(document.version_number) > Number(existing.version_number)) {
      latestByKey.set(key, document);
    }
  }
  const latestDocuments = [...latestByKey.values()];
  const documentIds = latestDocuments.map((document) => document.id);
  const revisionsResult = documentIds.length > 0
    ? await admin
        .from('teaching_document_revisions')
        .select('document_id,revision_number,storage_bucket,storage_path,original_filename,mime_type')
        .in('document_id', documentIds)
    : { data: [], error: null };
  const revisions = rows<RevisionRow>(revisionsResult.data, revisionsResult.error, 'approved document revisions');
  const revisionByKey = new Map(revisions.map((revision) => [
    `${revision.document_id}:${Number(revision.revision_number)}`,
    revision,
  ]));

  const ids = {
    trainer: [...new Set(allocations.map((allocation) => allocation.trainer_id))],
    unit: [...new Set(allocations.map((allocation) => allocation.unit_id))],
    cohort: [...new Set(allocations.map((allocation) => allocation.cohort_id))],
  };
  const [trainerResult, cohortResult] = await Promise.all([
    admin.from('trainers').select('id,staff_number,full_name').in('id', ids.trainer),
    admin.from('cohorts').select('id,name').in('id', ids.cohort),
  ]);
  const trainers = rows<TrainerRow>(trainerResult.data, trainerResult.error, 'trainers');
  const cohorts = rows<CohortRow>(cohortResult.data, cohortResult.error, 'cohorts');
  const trainerById = new Map(trainers.map((trainer) => [trainer.id, trainer]));
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const cohortById = new Map(cohorts.map((cohort) => [cohort.id, cohort]));
  const documentByKey = new Map(latestDocuments.map((document) => [
    `${document.allocation_id}:${document.document_type}`,
    document,
  ]));

  const lines: QaLine[] = [];
  const folderByTrainer = new Map<string, string>();
  for (const allocation of allocations) {
    const trainer = trainerById.get(allocation.trainer_id);
    const unit = unitById.get(allocation.unit_id);
    if (!trainer || !unit) continue;

    const staffNumber = trainer.staff_number?.trim() || trainer.id.slice(0, 8);
    const trainerName = trainer.full_name?.trim() || 'Trainer';
    const folder = `${safePathSegment(staffNumber)}_${safePathSegment(trainerName)}`;
    folderByTrainer.set(trainer.id, folder);

    for (const documentType of qaDocumentTypes) {
      const document = documentByKey.get(`${allocation.id}:${documentType}`);
      const revisionNumber = document?.approved_revision_number == null
        ? null
        : Number(document.approved_revision_number);
      const revision = document && revisionNumber != null
        ? revisionByKey.get(`${document.id}:${revisionNumber}`)
        : undefined;
      const cohortName = cohortById.get(allocation.cohort_id)?.name ?? 'Cohort';
      const directory = documentType === 'course_outline' ? 'Course Outlines' : 'Schemes of Work';
      const relativePath = `${folder}/${directory}/${safePathSegment(unit.code)}_${safePathSegment(unit.name)}_${safePathSegment(cohortName)}_${documentType}_allocation-${allocation.id.slice(0, 8)}_v${document ? Number(document.version_number) : 0}.${revision ? fileExtension(revision.original_filename) : 'pdf'}`;
      lines.push({
        allocationId: allocation.id,
        trainerId: trainer.id,
        staffNumber,
        trainerName,
        cohortName,
        unitCode: unit.code,
        unitName: unit.name,
        documentType,
        version: document ? Number(document.version_number) : null,
        approvedAt: document?.approved_at ?? null,
        status: revision ? 'Approved' : document ? 'Approved record; file unavailable' : 'Not approved',
        filePath: revision ? relativePath : '',
      });
    }
  }

  const lineByKey = new Map(lines.map((line) => [
    `${line.allocationId}:${line.documentType}`,
    line,
  ]));
  const downloadTasks: Array<{ line: QaLine; revision: RevisionRow }> = [];
  for (const allocation of allocations) {
    const trainer = trainerById.get(allocation.trainer_id);
    const unit = unitById.get(allocation.unit_id);
    const cohortName = cohortById.get(allocation.cohort_id)?.name ?? 'Cohort';
    if (!trainer || !unit) continue;
    for (const documentType of qaDocumentTypes) {
      const document = documentByKey.get(`${allocation.id}:${documentType}`);
      if (!document || document.approved_revision_number == null) continue;
      const revision = revisionByKey.get(`${document.id}:${Number(document.approved_revision_number)}`);
      if (!revision) continue;
      const line = lineByKey.get(`${allocation.id}:${documentType}`);
      if (line) downloadTasks.push({ line, revision });
    }
  }

  let totalSourceBytes = 0;
  let unavailableDocuments = 0;
  for (let start = 0; start < downloadTasks.length; start += 6) {
    const batch = downloadTasks.slice(start, start + 6);
    await Promise.all(batch.map(async ({ line, revision }) => {
      const result = await admin.storage.from(revision.storage_bucket).download(revision.storage_path);
      if (result.error || !result.data) {
        line.status = 'Approved record; file unavailable';
        line.filePath = '';
        return;
      }
      const file = Buffer.from(await result.data.arrayBuffer());
      totalSourceBytes += file.length;
      if (totalSourceBytes > MAX_ARCHIVE_INPUT_BYTES) {
        throw new Error('This QA pack exceeds the 200 MB export limit. Reduce the source document sizes before trying again.');
      }
      line.buffer = file;
    }));
  }
  unavailableDocuments = lines.filter((line) => line.status !== 'Approved').length;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Planner';
  workbook.subject = `Quality assurance examination documents for ${period.name}`;
  const index = workbook.addWorksheet('QA Index');
  index.columns = [
    { header: 'Trainer Staff No.', key: 'staffNumber', width: 18 },
    { header: 'Trainer', key: 'trainerName', width: 28 },
    { header: 'Cohort', key: 'cohortName', width: 24 },
    { header: 'Unit Code', key: 'unitCode', width: 16 },
    { header: 'Unit', key: 'unitName', width: 34 },
    { header: 'Document', key: 'document', width: 22 },
    { header: 'Status', key: 'status', width: 28 },
    { header: 'Version', key: 'version', width: 12 },
    { header: 'Approved At', key: 'approvedAt', width: 24 },
    { header: 'ZIP Path', key: 'filePath', width: 100 },
  ];
  index.addRows(lines.map((line) => ({
    staffNumber: line.staffNumber,
    trainerName: line.trainerName,
    cohortName: line.cohortName,
    unitCode: line.unitCode,
    unitName: line.unitName,
    document: documentLabel(line.documentType),
    status: line.status,
    version: line.version ?? '',
    approvedAt: line.approvedAt ? new Date(line.approvedAt) : '',
    filePath: line.filePath,
  })));
  index.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  index.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006B65' } };
  index.views = [{ state: 'frozen', ySplit: 1 }];
  index.autoFilter = { from: 'A1', to: 'J1' };
  index.getColumn(9).numFmt = 'dd mmm yyyy hh:mm';

  const entries: Array<{ name: string; data: Buffer; isDirectory?: boolean }> = [];
  for (const folder of new Set(folderByTrainer.values())) {
    entries.push({ name: `${folder}/`, data: Buffer.alloc(0), isDirectory: true });
    entries.push({ name: `${folder}/Course Outlines/`, data: Buffer.alloc(0), isDirectory: true });
    entries.push({ name: `${folder}/Schemes of Work/`, data: Buffer.alloc(0), isDirectory: true });
  }
  for (const line of lines) {
    if (line.buffer && line.filePath) entries.push({ name: line.filePath, data: line.buffer });
  }

  const indexBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  entries.push({ name: 'QA_Index.xlsx', data: indexBuffer });
  const readme = [
    `Quality Assurance Examination Pack — ${period.name}`,
    `Department: ${departmentName}`,
    `Period: ${period.starts_on} to ${period.ends_on}`,
    `Approved documents included: ${lines.filter((line) => Boolean(line.buffer)).length}`,
    `Required documents unavailable or not approved: ${unavailableDocuments}`,
    '',
    'Only the exact revisions approved by the department are included. See QA_Index.xlsx for each trainer, unit, approval status, and ZIP file path.',
    'Rows marked Not approved or Approved record; file unavailable are not included as document files.',
  ].join('\n');
  entries.push({ name: 'README.txt', data: Buffer.from(readme, 'utf8') });

  const archive = createZipArchive(entries);
  return {
    fileName: `QA_Examination_Pack_${safePathSegment(period.name)}.zip`,
    archive,
    includedDocuments: lines.filter((line) => Boolean(line.buffer)).length,
    unavailableDocuments,
  };
}
