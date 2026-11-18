import 'server-only';

import { randomUUID } from 'node:crypto';

import ExcelJS from 'exceljs';

import { requireHodAccess } from '@/features/auth/authorization';
import { loadAssessmentMarkbookBundle } from '@/features/assessment/markbook-bundle';
import {
  generateAssessmentMarkbook,
  type AssessmentMarkbookBundle,
} from '@/features/assessment/markbook-generator';
import { loadUnitSiblingResolver } from '@/features/assessment/unit-sibling-groups';
import { createAdminClient } from '@/lib/supabase/admin';
import { createZipArchive, safePathSegment, type ZipEntry } from '@/lib/zip-archive';

import { buildCatAnalysisDocx, buildExamAnalysisDocx } from './docx';
import { getActiveAssessmentPeriodReportData } from './queries';
import { getAssessmentReportReadiness } from './readiness';

export type MarksheetsZipType = 'cat' | 'final' | 'both';

type PeriodRow = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
};

type EventRow = {
  id: string;
  unit_id: string;
  title: string;
  assessment_type: 'cat' | 'exam';
  cat_marks_finalized_at: string | null;
  marks_submitted_at: string | null;
  exam_marks_finalized_at: string | null;
  operational_workflow_status: string | null;
};

type AllocationRow = {
  unit_id: string;
  trainer_id: string | null;
  cohort_id: string | null;
  participant_cohort_ids: string[] | null;
};

type TrainerRow = {
  id: string;
  staff_number: string | null;
  full_name: string | null;
};

type UnitRow = {
  id: string;
  code: string | null;
  name: string | null;
};

type MarksheetIndexLine = {
  staffNumber: string;
  trainerName: string;
  unitCode: string;
  unitName: string;
  cohorts: string;
  marksheetType: 'CAT' | 'Final Exam';
  status: string;
  studentCount: number;
  absentCount: number;
  filePath: string;
  buffer?: Buffer;
};

const MAX_ARCHIVE_INPUT_BYTES = 200 * 1024 * 1024;
const TERMINAL_WORKFLOW_STATUSES = new Set(['submitted', 'finalised', 'archived']);

function rows<T>(data: unknown, error: { message: string } | null, label: string): T[] {
  if (error) throw new Error(`Unable to load ${label}: ${error.message}`);
  return (data ?? []) as T[];
}

function cleanUuidList(ids: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      ids.filter(
        (id): id is string =>
          Boolean(id && typeof id === 'string' && id.trim() !== '' && id !== 'null' && id !== 'undefined'),
      ),
    ),
  ];
}

export async function createAssessmentMarksheetsZip({
  academicPeriodId,
  departmentId,
  departmentName,
  type = 'both',
}: {
  academicPeriodId: string;
  departmentId: string;
  departmentName?: string | null;
  type?: MarksheetsZipType;
}): Promise<{
  fileName: string;
  archive: Buffer;
  includedMarksheets: number;
  skippedMarksheets: number;
}> {
  await requireHodAccess();
  const admin = createAdminClient();

  const [periodResult, eventsResult] = await Promise.all([
    admin
      .from('academic_periods')
      .select('id,name,starts_on,ends_on')
      .eq('id', academicPeriodId)
      .maybeSingle(),
    admin
      .from('assessment_events')
      .select(
        'id,unit_id,title,assessment_type,cat_marks_finalized_at,marks_submitted_at,exam_marks_finalized_at,operational_workflow_status',
      )
      .eq('department_id', departmentId)
      .eq('academic_period_id', academicPeriodId),
  ]);

  if (periodResult.error) {
    throw new Error(`Unable to load academic period: ${periodResult.error.message}`);
  }
  const period = periodResult.data as PeriodRow | null;
  if (!period) {
    throw new Error('The selected academic period was not found.');
  }

  const allEvents = rows<EventRow>(eventsResult.data, eventsResult.error, 'assessment events');
  const candidateEvents = allEvents.filter(
    (event) => event.assessment_type === 'exam' || event.title === 'Unit Markbook',
  );
  const excludedIds = new Set<string>();
  if (candidateEvents.length > 0) {
    const { data: excludedRows, error: excludedError } = await admin
      .from('assessment_events')
      .select('id')
      .in('id', candidateEvents.map((e) => e.id))
      .eq('exclude_from_analysis', true);
    if (!excludedError) {
      for (const row of excludedRows ?? []) {
        if (row.id) excludedIds.add(row.id);
      }
    }
  }
  const validEvents = candidateEvents.filter((event) => !excludedIds.has(event.id));
  if (validEvents.length === 0) {
    throw new Error('No unit markbooks found for the selected academic period.');
  }

  const siblingResolver = await loadUnitSiblingResolver(admin, academicPeriodId);
  const unitIds = cleanUuidList(validEvents.map((event) => event.unit_id));
  const allocationUnitIds = cleanUuidList([
    ...unitIds,
    ...unitIds.flatMap((unitId) => siblingResolver.siblingsOf(unitId)),
  ]);
  const [unitsResult, allocationsResult] = await Promise.all([
    unitIds.length > 0
      ? admin.from('units').select('id,code,name').in('id', unitIds)
      : Promise.resolve({ data: [], error: null }),
    allocationUnitIds.length > 0
      ? admin
          .from('teaching_allocations')
          .select('unit_id,trainer_id,cohort_id,participant_cohort_ids')
          .eq('academic_period_id', academicPeriodId)
          .in('unit_id', allocationUnitIds)
          .in('status', ['draft', 'active', 'completed', 'archived'])
      : Promise.resolve({ data: [], error: null }),
  ]);

  const units = rows<UnitRow>(unitsResult.data, unitsResult.error, 'units');
  const allocations = rows<AllocationRow>(allocationsResult.data, allocationsResult.error, 'teaching allocations');

  const trainerIds = cleanUuidList(allocations.map((allocation) => allocation.trainer_id));
  const trainersResult =
    trainerIds.length > 0
      ? await admin.from('trainers').select('id,staff_number,full_name').in('id', trainerIds)
      : { data: [], error: null };
  const trainers = rows<TrainerRow>(trainersResult.data, trainersResult.error, 'trainers');

  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const trainerById = new Map(trainers.map((trainer) => [trainer.id, trainer]));

  // Map unitId -> Map<trainerId, Set<cohortId>>
  const trainerCohortsByUnit = new Map<string, Map<string, Set<string>>>();
  for (const allocation of allocations) {
    if (!allocation.unit_id || !allocation.trainer_id) continue;
    let byTrainer = trainerCohortsByUnit.get(allocation.unit_id);
    if (!byTrainer) {
      byTrainer = new Map<string, Set<string>>();
      trainerCohortsByUnit.set(allocation.unit_id, byTrainer);
    }
    let cohortSet = byTrainer.get(allocation.trainer_id);
    if (!cohortSet) {
      cohortSet = new Set<string>();
      byTrainer.set(allocation.trainer_id, cohortSet);
    }
    if (allocation.cohort_id) cohortSet.add(allocation.cohort_id);
    for (const participantId of allocation.participant_cohort_ids ?? []) {
      if (participantId) cohortSet.add(participantId);
    }
  }

  const requestedTypes: Array<'cat' | 'final'> =
    type === 'cat' ? ['cat'] : type === 'final' ? ['final'] : ['cat', 'final'];

  type GenerationTask = {
    event: EventRow;
    trainerId: string;
    staffNumber: string;
    trainerName: string;
    trainerFolder: string;
    unitCode: string;
    unitName: string;
    cohortIds: Set<string> | null;
    marksheetType: 'cat' | 'final';
    ready: boolean;
    notReadyReason: string;
    hasDirectAllocation: boolean;
  };

  // Deduplicate shared/equivalent sibling events per (trainerId, marksheetType, siblingGroupKey)
  // so each trainer receives ONE combined marksheet per shared class instead of identical copies
  // under each equivalent unit code (e.g. CND 1105 + DND 1105 Human Anatomy).
  const dedupedTasks = new Map<string, GenerationTask>();
  const trainerFolders = new Set<string>();

  for (const event of validEvents) {
    const unit = unitById.get(event.unit_id);
    const unitCode = unit?.code?.trim() || 'UNIT';
    const unitName = unit?.name?.trim() || 'Unit Markbook';

    const catReady = Boolean(event.cat_marks_finalized_at);
    const finalReady = Boolean(
      event.marks_submitted_at ||
        event.exam_marks_finalized_at ||
        TERMINAL_WORKFLOW_STATUSES.has(event.operational_workflow_status ?? ''),
    );

    const directByTrainer = trainerCohortsByUnit.get(event.unit_id);
    const hasDirectAllocation = Boolean(directByTrainer && directByTrainer.size > 0);
    let byTrainer = directByTrainer;
    if (!byTrainer || byTrainer.size === 0) {
      // Shared / equivalent unit whose teaching_allocation is recorded under a sibling unit code
      const merged = new Map<string, Set<string>>();
      for (const siblingUnitId of siblingResolver.siblingsOf(event.unit_id)) {
        const sibMap = trainerCohortsByUnit.get(siblingUnitId);
        if (!sibMap) continue;
        for (const [trainerId, cohorts] of sibMap.entries()) {
          let set = merged.get(trainerId);
          if (!set) {
            set = new Set<string>();
            merged.set(trainerId, set);
          }
          for (const cid of cohorts) set.add(cid);
        }
      }
      if (merged.size > 0) byTrainer = merged;
    }
    const trainerEntries: Array<{
      trainerId: string;
      staffNumber: string;
      trainerName: string;
      cohortIds: Set<string> | null;
    }> = [];

    if (byTrainer && byTrainer.size > 0) {
      for (const [trainerId, cohortIds] of byTrainer.entries()) {
        const trainer = trainerById.get(trainerId);
        const trainerName = trainer?.full_name?.trim() || 'Trainer';
        const staffNumber = trainer?.staff_number?.trim() || trainerId.slice(0, 8);
        trainerEntries.push({ trainerId, staffNumber, trainerName, cohortIds });
      }
    } else {
      trainerEntries.push({
        trainerId: 'unassigned',
        staffNumber: 'UNASSIGNED',
        trainerName: 'Unassigned Trainer',
        cohortIds: null,
      });
    }

    const groupKey = siblingResolver.groupKeyOf(event.unit_id);

    for (const entry of trainerEntries) {
      const trainerFolder = `${safePathSegment(entry.trainerName)}_${safePathSegment(entry.staffNumber)}`;
      trainerFolders.add(trainerFolder);

      for (const marksheetType of requestedTypes) {
        const ready = marksheetType === 'cat' ? catReady : finalReady;
        const notReadyReason =
          marksheetType === 'cat' ? 'CAT Marks Not Finalized' : 'Final Marks Not Submitted';
        const candidate: GenerationTask = {
          event,
          trainerId: entry.trainerId,
          staffNumber: entry.staffNumber,
          trainerName: entry.trainerName,
          trainerFolder,
          unitCode,
          unitName,
          cohortIds: entry.cohortIds ? new Set(entry.cohortIds) : null,
          marksheetType,
          ready,
          notReadyReason,
          hasDirectAllocation,
        };

        const dedupeKey = `${entry.trainerId}:${marksheetType}:${groupKey}`;
        const existing = dedupedTasks.get(dedupeKey);
        if (!existing) {
          dedupedTasks.set(dedupeKey, candidate);
        } else {
          // Merge any cohort IDs across sibling allocations for this trainer
          if (existing.cohortIds && candidate.cohortIds) {
            for (const cid of candidate.cohortIds) existing.cohortIds.add(cid);
          } else if (candidate.cohortIds && !existing.cohortIds) {
            existing.cohortIds = new Set(candidate.cohortIds);
          }

          // Prefer ready task, then direct-allocation unit code, then alphabetically earlier unit code
          const preferCandidate =
            (candidate.ready && !existing.ready) ||
            (candidate.ready === existing.ready && candidate.hasDirectAllocation && !existing.hasDirectAllocation) ||
            (candidate.ready === existing.ready &&
              candidate.hasDirectAllocation === existing.hasDirectAllocation &&
              candidate.unitCode.localeCompare(existing.unitCode) < 0);

          if (preferCandidate) {
            candidate.cohortIds = existing.cohortIds;
            dedupedTasks.set(dedupeKey, candidate);
          }
        }
      }
    }
  }

  const tasks = Array.from(dedupedTasks.values());

  // Load each ready assessment_event bundle once in bounded batches
  const readyEventIds = [...new Set(tasks.filter((t) => t.ready).map((t) => t.event.id))];
  const bundleByEventId = new Map<string, AssessmentMarkbookBundle>();
  const bundleErrorByEventId = new Map<string, string>();
  const generatedAt = new Date();

  for (let start = 0; start < readyEventIds.length; start += 4) {
    const batch = readyEventIds.slice(start, start + 4);
    await Promise.all(
      batch.map(async (eventId) => {
        try {
          const bundle = await loadAssessmentMarkbookBundle({
            rootAssessmentId: eventId,
            generationId: randomUUID(),
            generatedAt,
          });
          bundleByEventId.set(eventId, bundle);
        } catch (error) {
          bundleErrorByEventId.set(
            eventId,
            error instanceof Error ? error.message : 'Unable to load markbook data.',
          );
        }
      }),
    );
  }

  const lines: MarksheetIndexLine[] = [];
  let totalSourceBytes = 0;

  for (let start = 0; start < tasks.length; start += 4) {
    const batch = tasks.slice(start, start + 4);
    const batchLines = await Promise.all(
      batch.map(async (task): Promise<MarksheetIndexLine> => {
        const typeLabel = task.marksheetType === 'cat' ? 'CAT' : 'Final Exam';
        if (!task.ready) {
          return {
            staffNumber: task.staffNumber,
            trainerName: task.trainerName,
            unitCode: task.unitCode,
            unitName: task.unitName,
            cohorts: '—',
            marksheetType: typeLabel,
            status: task.notReadyReason,
            studentCount: 0,
            absentCount: 0,
            filePath: '',
          };
        }

        const bundleError = bundleErrorByEventId.get(task.event.id);
        const bundle = bundleByEventId.get(task.event.id);
        if (!bundle || bundleError) {
          return {
            staffNumber: task.staffNumber,
            trainerName: task.trainerName,
            unitCode: task.unitCode,
            unitName: task.unitName,
            cohorts: '—',
            marksheetType: typeLabel,
            status: bundleError ? `Error: ${bundleError}` : 'Markbook unavailable',
            studentCount: 0,
            absentCount: 0,
            filePath: '',
          };
        }

        const matchingCohorts =
          task.cohortIds && task.cohortIds.size > 0
            ? bundle.cohorts.filter((c) => c.cohortId && task.cohortIds!.has(c.cohortId))
            : bundle.cohorts;
        const scopedCohorts = matchingCohorts.length > 0 ? matchingCohorts : bundle.cohorts;
        const cohortNames = scopedCohorts.map((c) => c.cohortName).join(', ') || '—';

        const studentCount = scopedCohorts.reduce((sum, c) => sum + c.students.length, 0);
        const absentCount = scopedCohorts.reduce(
          (sum, c) => sum + c.students.filter((s) => s.attendanceStatus === 'absent').length,
          0,
        );

        if (studentCount === 0) {
          return {
            staffNumber: task.staffNumber,
            trainerName: task.trainerName,
            unitCode: task.unitCode,
            unitName: task.unitName,
            cohorts: cohortNames,
            marksheetType: typeLabel,
            status: 'No Registered Students',
            studentCount: 0,
            absentCount: 0,
            filePath: '',
          };
        }

        const scopedBundle: AssessmentMarkbookBundle = {
          ...bundle,
          cohorts: scopedCohorts,
          marksheetType: task.marksheetType,
        };

        const workbookBuffer = await generateAssessmentMarkbook(scopedBundle, {
          marksheetType: task.marksheetType,
        });

        const subFolder = task.marksheetType === 'cat' ? 'CAT Marksheets' : 'Exam Marksheets';
        const suffix = task.marksheetType === 'cat' ? 'CAT_Marksheet' : 'Final_Marksheet';
        const filePath = `${task.trainerFolder}/${subFolder}/${safePathSegment(task.unitCode)}_${safePathSegment(task.unitName)}_${suffix}.xlsx`;

        return {
          staffNumber: task.staffNumber,
          trainerName: task.trainerName,
          unitCode: task.unitCode,
          unitName: task.unitName,
          cohorts: cohortNames,
          marksheetType: typeLabel,
          status: 'Included',
          studentCount,
          absentCount,
          filePath,
          buffer: workbookBuffer,
        };
      }),
    );

    for (const line of batchLines) {
      if (line.buffer) {
        totalSourceBytes += line.buffer.length;
        if (totalSourceBytes > MAX_ARCHIVE_INPUT_BYTES) {
          throw new Error(
            'This marksheets pack exceeds the 200 MB export limit. Export CAT or Final marksheets separately.',
          );
        }
      }
      lines.push(line);
    }
  }

  // Build Excel Manifest
  const indexWorkbook = new ExcelJS.Workbook();
  indexWorkbook.creator = 'Academic Planner';
  indexWorkbook.subject = `CAT & Exam Marksheets Pack for ${period.name}`;
  const sheet = indexWorkbook.addWorksheet('Marksheets Index');
  sheet.columns = [
    { header: 'Trainer Staff No.', key: 'staffNumber', width: 18 },
    { header: 'Trainer', key: 'trainerName', width: 28 },
    { header: 'Unit Code', key: 'unitCode', width: 14 },
    { header: 'Unit Name', key: 'unitName', width: 34 },
    { header: 'Cohorts', key: 'cohorts', width: 28 },
    { header: 'Marksheet Type', key: 'marksheetType', width: 16 },
    { header: 'Status', key: 'status', width: 26 },
    { header: 'Students', key: 'studentCount', width: 12 },
    { header: 'Absent', key: 'absentCount', width: 12 },
    { header: 'ZIP Path', key: 'filePath', width: 85 },
  ];
  sheet.addRows(
    lines.map((line) => ({
      staffNumber: line.staffNumber,
      trainerName: line.trainerName,
      unitCode: line.unitCode,
      unitName: line.unitName,
      cohorts: line.cohorts,
      marksheetType: line.marksheetType,
      status: line.status,
      studentCount: line.studentCount,
      absentCount: line.absentCount,
      filePath: line.filePath,
    })),
  );
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102B54' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'J1' };

  const entries: ZipEntry[] = [];
  for (const folder of trainerFolders) {
    entries.push({ name: `${folder}/`, data: Buffer.alloc(0), isDirectory: true });
    if (type === 'cat' || type === 'both') {
      entries.push({ name: `${folder}/CAT Marksheets/`, data: Buffer.alloc(0), isDirectory: true });
    }
    if (type === 'final' || type === 'both') {
      entries.push({ name: `${folder}/Exam Marksheets/`, data: Buffer.alloc(0), isDirectory: true });
    }
  }

  const addedZipPaths = new Set<string>();
  for (const line of lines) {
    if (line.buffer && line.filePath) {
      if (addedZipPaths.has(line.filePath)) continue;
      addedZipPaths.add(line.filePath);
      entries.push({ name: line.filePath, data: line.buffer });
    }
  }

  // Optionally include department-wide CAT & Exam Analysis Word reports if ready
  const includedReports: string[] = [];
  try {
    const reportData = await getActiveAssessmentPeriodReportData(academicPeriodId);
    if (reportData) {
      const readiness = getAssessmentReportReadiness(reportData);
      const reportJobs: Array<{ include: boolean; filename: string; build: () => Promise<Buffer> }> = [
        {
          include: (type === 'cat' || type === 'both') && readiness.catReady,
          filename: `${safePathSegment(period.name)}-CAT-ANALYSIS.docx`,
          build: () => buildCatAnalysisDocx(reportData),
        },
        {
          include: (type === 'final' || type === 'both') && readiness.examReady,
          filename: `${safePathSegment(period.name)}-EXAM-ANALYSIS.docx`,
          build: () => buildExamAnalysisDocx(reportData),
        },
      ];

      const readyJobs = reportJobs.filter((job) => job.include);
      if (readyJobs.length > 0) {
        entries.push({ name: 'Department_Reports/', data: Buffer.alloc(0), isDirectory: true });
        for (const job of readyJobs) {
          const docBuffer = await job.build();
          entries.push({ name: `Department_Reports/${job.filename}`, data: docBuffer });
          includedReports.push(job.filename);
        }
      }
    }
  } catch (err) {
    console.warn('Optional department analysis report generation failed during ZIP export:', err);
  }

  const indexBuffer = Buffer.from(await indexWorkbook.xlsx.writeBuffer());
  entries.push({ name: 'Marksheets_Index.xlsx', data: indexBuffer });

  const includedMarksheets = lines.filter((line) => Boolean(line.buffer)).length;
  const skippedMarksheets = lines.length - includedMarksheets;

  const readme = [
    `CAT & Exam Results Marksheets Pack — ${period.name}`,
    `Department: ${departmentName || 'Department Management System'}`,
    `Period: ${period.starts_on} to ${period.ends_on}`,
    `Export Scope: ${type === 'cat' ? 'CAT Marksheets Only' : type === 'final' ? 'Final Exam Marksheets Only' : 'CAT & Final Exam Marksheets'}`,
    `Included Marksheets: ${includedMarksheets}`,
    `Pending / Skipped Marksheets: ${skippedMarksheets}`,
    includedReports.length > 0 ? `Department Reports Included: ${includedReports.join(', ')}` : 'Department Reports Included: None ready',
    '',
    'Each trainer folder contains dedicated subfolders for CAT Marksheets and/or Exam Marksheets.',
    'See Marksheets_Index.xlsx for the complete breakdown of included units, pending submissions, and ZIP paths.',
  ].join('\n');
  entries.push({ name: 'README.txt', data: Buffer.from(readme, 'utf8') });

  const archive = createZipArchive(entries);
  const scopeSlug = type === 'cat' ? 'CAT' : type === 'final' ? 'Final_Exam' : 'CAT_and_Exam';
  return {
    fileName: `Marksheets_${scopeSlug}_${safePathSegment(period.name)}.zip`,
    archive,
    includedMarksheets,
    skippedMarksheets,
  };
}
