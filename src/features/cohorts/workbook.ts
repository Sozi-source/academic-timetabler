import ExcelJS from 'exceljs';

import { formatStudentStage } from '@/features/students/student-status-stage';

import {
  cohortStatusOptions,
  type Cohort,
  type CohortStatus,
} from './types';

export interface CohortExportStudent {
  admissionNumber: string;
  fullName: string;
  cohortId: string;
  cohortCode: string;
  cohortName: string;
  programmeCode: string;
  programmeName: string;
  currentStage: string;
  lifecycleStatus: string;
  academicPhase: string;
  phoneNumber?: string | null;
  email?: string | null;
  detailsVerifiedAt?: string | null;
}

export interface CohortExportOptions {
  cohorts: Cohort[];
  students?: CohortExportStudent[];
  departmentName?: string;
  exportedAt?: Date;
  filters?: {
    programmeName?: string;
    status?: string;
    availability?: string;
    search?: string;
  };
}

export function getCohortStatusLabel(status: CohortStatus | string): string {
  const match = cohortStatusOptions.find((option) => option.value === status);
  return match ? match.label : status.charAt(0).toUpperCase() + status.slice(1);
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.height = 26;
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2F706B' }, // Institutional dark teal
  };
  row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
}

function styleSubHeaderRow(row: ExcelJS.Row) {
  row.height = 22;
  row.font = { bold: true, color: { argb: 'FF1C403D' }, size: 10 };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6EFEA' }, // Soft teal tint
  };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
}

function applySheetZebra(sheet: ExcelJS.Worksheet, startRowIndex: number = 2) {
  sheet.eachRow((row, rowIndex) => {
    if (rowIndex >= startRowIndex) {
      row.alignment = { vertical: 'top', wrapText: true };
      if (rowIndex % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF7FAF9' }, // Light alternating zebra tint
        };
      }
    }
  });
}

/**
 * Builds an ExcelJS Workbook with:
 * 1. Cohorts — Complete cohort master registry with capacity, timetable status & study period.
 * 2. Summary & Census — Key metrics, programme breakdown & lifecycle status breakdown.
 * 3. Enrolled Students — Optional roster of students linked to the cohorts.
 */
export async function generateCohortExportWorkbook(
  options: CohortExportOptions,
): Promise<ExcelJS.Workbook> {
  const {
    cohorts,
    students = [],
    departmentName = 'Nutrition & Health Sciences',
    exportedAt = new Date(),
    filters,
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Planning System';
  workbook.created = exportedAt;
  workbook.modified = exportedAt;
  workbook.subject = `Cohort Data Export - ${departmentName}`;

  // =========================================================================
  // 1. WORKSHEET: Cohorts (Master Table)
  // =========================================================================
  const cohortsSheet = workbook.addWorksheet('Cohorts', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  cohortsSheet.columns = [
    { header: 'Cohort Code', key: 'code', width: 22 },
    { header: 'Cohort Name', key: 'name', width: 32 },
    { header: 'Programme Code', key: 'programmeCode', width: 18 },
    { header: 'Programme Name', key: 'programmeName', width: 36 },
    { header: 'Study Period (Y/S)', key: 'studyPeriod', width: 18 },
    { header: 'Lifecycle Status', key: 'status', width: 18 },
    { header: 'Timetable Status', key: 'timetableStatus', width: 18 },
    { header: 'Enrolled Learners', key: 'actualSize', width: 18 },
    { header: 'Planned Capacity', key: 'plannedSize', width: 18 },
    { header: 'Capacity Utilisation', key: 'utilisation', width: 22 },
    { header: 'Intake Date', key: 'intakeDate', width: 16 },
    { header: 'Expected Completion', key: 'expectedCompletionDate', width: 22 },
    { header: 'Notes', key: 'notes', width: 40 },
    { header: 'Created Date', key: 'createdAt', width: 16 },
  ];

  styleHeaderRow(cohortsSheet.getRow(1));
  cohortsSheet.autoFilter = { from: 'A1', to: 'N1' };

  for (const cohort of cohorts) {
    const studyPeriod = formatStudentStage(cohort.currentAcademicPeriodNumber);
    const statusLabel = getCohortStatusLabel(cohort.status);
    const timetableLabel = cohort.isTimetableAvailable ? 'Available' : 'Unavailable';
    const utilisation =
      cohort.plannedSize && cohort.plannedSize > 0
        ? `${Math.round((cohort.actualSize / cohort.plannedSize) * 100)}%`
        : '—';

    const row = cohortsSheet.addRow({
      code: cohort.code,
      name: cohort.name,
      programmeCode: cohort.programme?.code ?? '—',
      programmeName: cohort.programme?.name ?? '—',
      studyPeriod,
      status: statusLabel,
      timetableStatus: timetableLabel,
      actualSize: cohort.actualSize,
      plannedSize: cohort.plannedSize ?? '—',
      utilisation,
      intakeDate: cohort.intakeDate,
      expectedCompletionDate: cohort.expectedCompletionDate,
      notes: cohort.notes ?? '',
      createdAt: cohort.createdAt ? cohort.createdAt.slice(0, 10) : '',
    });

    // Format numeric columns
    const actualCell = row.getCell('actualSize');
    actualCell.numFmt = '#,##0';
    if (typeof cohort.plannedSize === 'number') {
      const plannedCell = row.getCell('plannedSize');
      plannedCell.numFmt = '#,##0';
    }
  }

  applySheetZebra(cohortsSheet, 2);

  // =========================================================================
  // 2. WORKSHEET: Summary & Census
  // =========================================================================
  const summarySheet = workbook.addWorksheet('Summary & Census', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  summarySheet.columns = [
    { header: 'Metric / Category', key: 'colA', width: 34 },
    { header: 'Value / Name', key: 'colB', width: 34 },
    { header: 'Total Cohorts', key: 'colC', width: 18 },
    { header: 'Active Cohorts', key: 'colD', width: 18 },
    { header: 'Enrolled Learners', key: 'colE', width: 20 },
    { header: 'Timetable Available', key: 'colF', width: 20 },
  ];

  styleHeaderRow(summarySheet.getRow(1));

  // Compute summary metrics
  const totalCohorts = cohorts.length;
  const activeCohorts = cohorts.filter((c) => c.status === 'active');
  const plannedCohorts = cohorts.filter((c) => c.status === 'planned');
  const suspendedCohorts = cohorts.filter((c) => c.status === 'suspended');
  const completedCohorts = cohorts.filter((c) => c.status === 'completed');
  const archivedCohorts = cohorts.filter((c) => c.status === 'archived');
  const timetableAvailableCohorts = cohorts.filter((c) => c.isTimetableAvailable);
  const totalEnrolledLearners = cohorts.reduce((acc, c) => acc + (c.actualSize || 0), 0);
  const avgCohortSize = activeCohorts.length > 0
    ? (activeCohorts.reduce((acc, c) => acc + (c.actualSize || 0), 0) / activeCohorts.length).toFixed(1)
    : '0';

  const distinctProgrammes = new Set(cohorts.map((c) => c.programmeId).filter(Boolean));

  // Meta info & KPIs
  summarySheet.addRow({ colA: 'Department', colB: departmentName });
  summarySheet.addRow({ colA: 'Generated At', colB: exportedAt.toISOString().replace('T', ' ').slice(0, 19) });

  if (filters) {
    if (filters.programmeName) summarySheet.addRow({ colA: 'Filter: Programme', colB: filters.programmeName });
    if (filters.status) summarySheet.addRow({ colA: 'Filter: Status', colB: getCohortStatusLabel(filters.status) });
    if (filters.availability) summarySheet.addRow({ colA: 'Filter: Availability', colB: filters.availability });
    if (filters.search) summarySheet.addRow({ colA: 'Filter: Search', colB: filters.search });
  }

  summarySheet.addRow({}); // blank row

  // Key KPI Table Header
  const kpiSectionHeader = summarySheet.addRow({ colA: 'KEY PERFORMANCE INDICATORS', colB: '' });
  styleSubHeaderRow(kpiSectionHeader);

  summarySheet.addRow({ colA: 'Total Cohorts Registered', colB: totalCohorts });
  summarySheet.addRow({ colA: 'Active Cohorts', colB: activeCohorts.length });
  summarySheet.addRow({ colA: 'Planned Future Cohorts', colB: plannedCohorts.length });
  summarySheet.addRow({ colA: 'Suspended Cohorts', colB: suspendedCohorts.length });
  summarySheet.addRow({ colA: 'Completed Cohorts', colB: completedCohorts.length });
  summarySheet.addRow({ colA: 'Archived Cohorts', colB: archivedCohorts.length });
  summarySheet.addRow({ colA: 'Timetable Available Cohorts', colB: timetableAvailableCohorts.length });
  summarySheet.addRow({ colA: 'Total Enrolled Learners', colB: totalEnrolledLearners });
  summarySheet.addRow({ colA: 'Average Active Cohort Size', colB: avgCohortSize });
  summarySheet.addRow({ colA: 'Distinct Programmes Represented', colB: distinctProgrammes.size });

  summarySheet.addRow({}); // blank row

  // Programme Breakdown
  const programmeSectionHeader = summarySheet.addRow({
    colA: 'Programme Code',
    colB: 'Programme Name',
    colC: 'Total Cohorts',
    colD: 'Active Cohorts',
    colE: 'Enrolled Learners',
    colF: 'Timetable Available',
  });
  styleSubHeaderRow(programmeSectionHeader);

  const programmeMap = new Map<
    string,
    {
      code: string;
      name: string;
      total: number;
      active: number;
      learners: number;
      timetable: number;
    }
  >();

  for (const c of cohorts) {
    const progCode = c.programme?.code ?? 'Unassigned';
    const progName = c.programme?.name ?? 'Unassigned Programme';
    const existing = programmeMap.get(progCode) ?? {
      code: progCode,
      name: progName,
      total: 0,
      active: 0,
      learners: 0,
      timetable: 0,
    };
    existing.total += 1;
    if (c.status === 'active') existing.active += 1;
    existing.learners += c.actualSize || 0;
    if (c.isTimetableAvailable) existing.timetable += 1;
    programmeMap.set(progCode, existing);
  }

  for (const prog of [...programmeMap.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    summarySheet.addRow({
      colA: prog.code,
      colB: prog.name,
      colC: prog.total,
      colD: prog.active,
      colE: prog.learners,
      colF: prog.timetable,
    });
  }

  summarySheet.addRow({}); // blank row

  // Status Breakdown
  const statusSectionHeader = summarySheet.addRow({
    colA: 'Lifecycle Status',
    colB: 'Number of Cohorts',
    colC: 'Total Enrolled Learners',
    colD: 'Share of Cohorts',
  });
  styleSubHeaderRow(statusSectionHeader);

  const statusMap = new Map<string, { count: number; learners: number }>();
  for (const c of cohorts) {
    const s = c.status;
    const cur = statusMap.get(s) ?? { count: 0, learners: 0 };
    cur.count += 1;
    cur.learners += c.actualSize || 0;
    statusMap.set(s, cur);
  }

  for (const option of cohortStatusOptions) {
    const stat = statusMap.get(option.value) ?? { count: 0, learners: 0 };
    const pct = totalCohorts > 0 ? `${Math.round((stat.count / totalCohorts) * 100)}%` : '0%';
    summarySheet.addRow({
      colA: option.label,
      colB: stat.count,
      colC: stat.learners,
      colD: pct,
    });
  }

  // =========================================================================
  // 3. WORKSHEET: Enrolled Students (Roster)
  // =========================================================================
  if (students.length > 0) {
    const studentsSheet = workbook.addWorksheet('Enrolled Students', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    studentsSheet.columns = [
      { header: 'Admission Number', key: 'admissionNumber', width: 24 },
      { header: 'Student Name', key: 'fullName', width: 34 },
      { header: 'Cohort Code', key: 'cohortCode', width: 22 },
      { header: 'Cohort Name', key: 'cohortName', width: 30 },
      { header: 'Programme Code', key: 'programmeCode', width: 18 },
      { header: 'Programme Name', key: 'programmeName', width: 34 },
      { header: 'Study Period (Y/S)', key: 'currentStage', width: 18 },
      { header: 'Lifecycle Status', key: 'lifecycleStatus', width: 18 },
      { header: 'Academic Phase', key: 'academicPhase', width: 18 },
      { header: 'Phone Number', key: 'phoneNumber', width: 18 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Details Verified', key: 'detailsVerified', width: 16 },
    ];

    styleHeaderRow(studentsSheet.getRow(1));
    studentsSheet.autoFilter = { from: 'A1', to: 'L1' };

    for (const student of students) {
      studentsSheet.addRow({
        admissionNumber: student.admissionNumber,
        fullName: student.fullName,
        cohortCode: student.cohortCode,
        cohortName: student.cohortName,
        programmeCode: student.programmeCode,
        programmeName: student.programmeName,
        currentStage: student.currentStage,
        lifecycleStatus: student.lifecycleStatus.replace('_', ' '),
        academicPhase: student.academicPhase.replace('_', ' '),
        phoneNumber: student.phoneNumber ?? '—',
        email: student.email ?? '—',
        detailsVerified: student.detailsVerifiedAt ? 'Yes' : 'No',
      });
    }

    applySheetZebra(studentsSheet, 2);
  }

  return workbook;
}
