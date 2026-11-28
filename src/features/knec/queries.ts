import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireHodAccess } from '@/features/auth/authorization';
import { getMissingKnecBiodataFields } from '@/features/student-portal/profile';
import { createAdminClient } from '@/lib/supabase/admin';

import {
  canonicalKnecTrackLabel,
  deriveStudentKnecProgress,
  type StoredModuleStatusInput,
} from './domain';
import type {
  KnecBookingFormContext,
  KnecBookingPaperRecord,
  KnecBookingRecord,
  KnecBookingStatus,
  KnecExamSeriesItem,
  KnecExamSeriesStatus,
  KnecModuleItem,
  KnecModuleStatus,
  KnecPaperItem,
  KnecPaperResultStatus,
  StudentKnecSummary,
} from './types';

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

const PAGE_SIZE = 1000;

async function fetchAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> },
  label: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Unable to load ${label}: ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

interface CatalogModuleRow {
  id: string;
  course_family: string;
  module_code: string;
  module_number: number;
  title: string;
  sequence_order: number;
}

interface CatalogPaperRow {
  id: string;
  module_id: string;
  paper_code: string;
  paper_number: string;
  paper_name: string;
  paper_type: 'theory' | 'practice' | 'trade_project' | 'coursework';
  sort_order: number;
}

interface ProgrammeRuleRow {
  programme_code: string;
  module_id: string;
  requirement_role: 'core' | 'prerequisite_cert' | 'transition_core';
  display_order: number;
}

interface ExamSeriesRow {
  id: string;
  series_code: string;
  series_name: string;
  series_month: string;
  series_year: number;
  status: KnecExamSeriesStatus;
  booking_opens_on: string | null;
  booking_closes_on: string | null;
  notes: string | null;
}

interface StoredStatusRow {
  student_id: string;
  module_id: string;
  status: KnecModuleStatus;
  completion_source: 'historical_import' | 'booking_results' | 'manual_override' | 'derived';
  completed_series_id: string | null;
  knec_index_number: string | null;
  resit_paper_codes: string[] | null;
  notes: string | null;
}

interface BookingRow {
  id: string;
  student_id: string;
  series_id: string;
  knec_index_number: string | null;
  booking_type: 'normal' | 'resit' | 'mixed' | 'historical';
  booking_status: KnecBookingStatus;
  clearance_ref: string | null;
  submitted_at: string | null;
  hod_cleared_at: string | null;
  notes: string | null;
  created_at: string;
}

interface BookingPaperRow {
  id: string;
  booking_id: string;
  student_id: string;
  series_id: string;
  module_id: string;
  paper_id: string | null;
  paper_code: string;
  paper_name: string;
  is_resit: boolean;
  paper_status: KnecPaperResultStatus;
  grade: string | null;
  remarks: string | null;
}

export async function loadDepartmentKnecCatalog(admin: SupabaseClient, departmentId: string) {
  const [moduleRows, paperRows, ruleRows, seriesRows] = await Promise.all([
    fetchAll<CatalogModuleRow>(
      () =>
        admin
          .from('knec_modules')
          .select('id,course_family,module_code,module_number,title,sequence_order')
          .eq('department_id', departmentId)
          .eq('is_active', true)
          .order('sequence_order', { ascending: true }),
      'KNEC modules',
    ),
    fetchAll<CatalogPaperRow>(
      () =>
        admin
          .from('knec_papers')
          .select('id,module_id,paper_code,paper_number,paper_name,paper_type,sort_order')
          .eq('department_id', departmentId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      'KNEC papers',
    ),
    fetchAll<ProgrammeRuleRow>(
      () =>
        admin
          .from('knec_programme_module_rules')
          .select('programme_code,module_id,requirement_role,display_order')
          .eq('department_id', departmentId)
          .order('display_order', { ascending: true }),
      'KNEC programme rules',
    ),
    fetchAll<ExamSeriesRow>(
      () =>
        admin
          .from('knec_exam_series')
          .select('id,series_code,series_name,series_month,series_year,status,booking_opens_on,booking_closes_on,notes')
          .eq('department_id', departmentId)
          .order('series_year', { ascending: false })
          .order('series_name', { ascending: false }),
      'KNEC exam series',
    ),
  ]);

  const moduleCodeById = new Map(moduleRows.map((m) => [m.id, m.module_code]));
  const papersByModuleId = new Map<string, KnecPaperItem[]>();
  for (const p of paperRows) {
    const list = papersByModuleId.get(p.module_id) ?? [];
    list.push({
      id: p.id,
      moduleId: p.module_id,
      moduleCode: moduleCodeById.get(p.module_id) ?? '',
      paperCode: p.paper_code,
      paperNumber: p.paper_number,
      paperName: p.paper_name,
      paperType: p.paper_type,
      sortOrder: p.sort_order,
    });
    papersByModuleId.set(p.module_id, list);
  }

  const baseModuleMap = new Map<string, Omit<KnecModuleItem, 'requirementRole'>>();
  for (const m of moduleRows) {
    baseModuleMap.set(m.id, {
      id: m.id,
      courseFamily: m.course_family,
      moduleCode: m.module_code,
      moduleNumber: m.module_number,
      title: m.title,
      sequenceOrder: m.sequence_order,
      papers: papersByModuleId.get(m.id) ?? [],
    });
  }

  const modulesByProgCode = new Map<string, KnecModuleItem[]>();
  for (const r of ruleRows) {
    const base = baseModuleMap.get(r.module_id);
    if (!base) continue;
    const code = r.programme_code.trim().toUpperCase();
    const list = modulesByProgCode.get(code) ?? [];
    list.push({ ...base, requirementRole: r.requirement_role });
    modulesByProgCode.set(code, list);
  }

  const series: KnecExamSeriesItem[] = seriesRows.map((s) => ({
    id: s.id,
    seriesCode: s.series_code,
    seriesName: s.series_name,
    seriesMonth: s.series_month,
    seriesYear: s.series_year,
    status: s.status,
    bookingOpensOn: s.booking_opens_on,
    bookingClosesOn: s.booking_closes_on,
    notes: s.notes,
  }));

  return {
    allModules: Array.from(baseModuleMap.values()).map((m) => ({
      ...m,
      requirementRole: 'core' as const,
    })),
    moduleCodeById,
    modulesByProgCode,
    series,
  };
}

function hydrateBookings(
  bookingRows: BookingRow[],
  paperRows: BookingPaperRow[],
  seriesMap: Map<string, KnecExamSeriesItem>,
  moduleCodeById: Map<string, string>,
): KnecBookingRecord[] {
  const papersByBookingId = new Map<string, KnecBookingPaperRecord[]>();
  for (const p of paperRows) {
    const list = papersByBookingId.get(p.booking_id) ?? [];
    list.push({
      id: p.id,
      bookingId: p.booking_id,
      moduleId: p.module_id,
      moduleCode: moduleCodeById.get(p.module_id) ?? p.paper_code.split('/')[0] ?? '',
      paperId: p.paper_id,
      paperCode: p.paper_code,
      paperName: p.paper_name,
      isResit: p.is_resit,
      paperStatus: p.paper_status,
      grade: p.grade,
      remarks: p.remarks,
    });
    papersByBookingId.set(p.booking_id, list);
  }

  return bookingRows
    .map((b) => {
      const s = seriesMap.get(b.series_id);
      return {
        id: b.id,
        studentId: b.student_id,
        seriesId: b.series_id,
        seriesName: s?.seriesName ?? 'KNEC Series',
        seriesCode: s?.seriesCode ?? '',
        seriesYear: s?.seriesYear ?? 0,
        seriesMonth: s?.seriesMonth ?? '',
        seriesStatus: s?.status ?? 'planned',
        knecIndexNumber: b.knec_index_number,
        bookingType: b.booking_type,
        bookingStatus: b.booking_status,
        clearanceRef: b.clearance_ref,
        submittedAt: b.submitted_at,
        hodClearedAt: b.hod_cleared_at,
        notes: b.notes,
        papers: (papersByBookingId.get(b.id) ?? []).sort((a, z) =>
          a.paperCode.localeCompare(z.paperCode, 'en', { numeric: true }),
        ),
      };
    })
    .sort((a, b) => b.seriesYear - a.seriesYear || a.seriesName.localeCompare(b.seriesName));
}

export async function getStudentKnecPortalData(studentId: string): Promise<{
  departmentId: string;
  summary: StudentKnecSummary;
  series: KnecExamSeriesItem[];
  openSeries: KnecExamSeriesItem[];
} | null> {
  const admin = createAdminClient() as unknown as SupabaseClient;

  const { data: stuRow, error: stuErr } = await admin
    .from('students')
    .select(`
      id,department_id,admission_number,full_name,lifecycle_status,academic_phase,knec_index_number,
      kcse_index_number,national_id_number,phone_number,birth_certificate_entry_number,
      programme:programmes(id,code,name),
      department:departments(id,name),
      current_cohort:cohorts!students_current_cohort_id_fkey(id,name),
      admission_cohort:cohorts!students_admission_cohort_id_fkey(id,name)
    `)
    .eq('id', studentId)
    .maybeSingle();

  if (stuErr || !stuRow) return null;

  const prog = one(stuRow.programme as Relation<{ id: string; code: string; name: string }>);
  const dept = one(stuRow.department as Relation<{ id: string; name: string }>);
  const currentCohort = one(stuRow.current_cohort as Relation<{ id: string; name: string }>);
  const admissionCohort = one(stuRow.admission_cohort as Relation<{ id: string; name: string }>);
  const departmentId = String(stuRow.department_id ?? dept?.id ?? '');
  if (!departmentId) return null;

  const [catalog, storedRows, bookingRows, bookingPaperRows] = await Promise.all([
    loadDepartmentKnecCatalog(admin, departmentId),
    fetchAll<StoredStatusRow>(
      () =>
        admin
          .from('student_knec_module_statuses')
          .select('student_id,module_id,status,completion_source,completed_series_id,knec_index_number,resit_paper_codes,notes')
          .eq('student_id', studentId)
          .order('module_id', { ascending: true }),
      'student KNEC statuses',
    ),
    fetchAll<BookingRow>(
      () =>
        admin
          .from('student_knec_bookings')
          .select('id,student_id,series_id,knec_index_number,booking_type,booking_status,clearance_ref,submitted_at,hod_cleared_at,notes,created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false }),
      'student KNEC bookings',
    ),
    fetchAll<BookingPaperRow>(
      () =>
        admin
          .from('student_knec_booking_papers')
          .select('id,booking_id,student_id,series_id,module_id,paper_id,paper_code,paper_name,is_resit,paper_status,grade,remarks')
          .eq('student_id', studentId)
          .order('paper_code', { ascending: true }),
      'student KNEC papers',
    ),
  ]);

  const progCode = (prog?.code ?? '').trim().toUpperCase();
  const seriesMap = new Map(catalog.series.map((s) => [s.id, s]));
  const bookings = hydrateBookings(bookingRows, bookingPaperRows, seriesMap, catalog.moduleCodeById);
  const modulesForProg = catalog.modulesByProgCode.get(progCode) ?? [];

  const storedInputs: StoredModuleStatusInput[] = storedRows.map((row) => ({
    moduleId: row.module_id,
    status: row.status,
    completionSource: row.completion_source,
    completedSeriesName: row.completed_series_id ? seriesMap.get(row.completed_series_id)?.seriesName ?? null : null,
    resitPaperCodes: row.resit_paper_codes ?? [],
    notes: row.notes,
  }));

  const progress = deriveStudentKnecProgress({
    modules: modulesForProg,
    storedStatuses: storedInputs,
    bookings,
  });

  const latestBookingIndex = bookings.find((b) => Boolean(b.knecIndexNumber))?.knecIndexNumber ?? null;
  const missingProfileFields = getMissingKnecBiodataFields({
    kcseIndexNumber: stuRow.kcse_index_number as string | null,
    nationalIdNumber: stuRow.national_id_number as string | null,
    phoneNumber: stuRow.phone_number as string | null,
    birthCertificateEntryNumber: stuRow.birth_certificate_entry_number as string | null,
  });

  const summary: StudentKnecSummary = {
    studentId: String(stuRow.id),
    admissionNumber: String(stuRow.admission_number),
    fullName: String(stuRow.full_name),
    programmeId: prog?.id ?? null,
    programmeCode: progCode,
    programmeName: prog?.name ?? progCode,
    equivalentTrackLabel: canonicalKnecTrackLabel(progCode),
    departmentName: dept?.name ?? 'Human Nutrition and Dietetics',
    cohortName: currentCohort?.name ?? admissionCohort?.name ?? null,
    lifecycleStatus: String(stuRow.lifecycle_status ?? ''),
    academicPhase: String(stuRow.academic_phase ?? ''),
    knecIndexNumber: (stuRow.knec_index_number as string | null) ?? latestBookingIndex,
    missingProfileFields,
    modules: progress.items,
    bookings,
    requiredCount: progress.requiredCount,
    completedCount: progress.completedCount,
    resitCount: progress.resitCount,
    bookedCount: progress.bookedCount,
    pendingCount: progress.pendingCount,
    completionPercent: progress.completionPercent,
    overallStatus: progress.overallStatus,
  };

  return {
    departmentId,
    summary,
    series: catalog.series,
    openSeries: catalog.series.filter((s) => s.status === 'booking_open'),
  };
}

export async function getKnecBookingFormContext(params: {
  studentId: string;
  bookingId?: string;
}): Promise<KnecBookingFormContext | null> {
  const portalData = await getStudentKnecPortalData(params.studentId);
  if (!portalData) return null;

  const activeBookings = portalData.summary.bookings.filter((b) => b.bookingStatus !== 'cancelled');
  const booking = params.bookingId
    ? activeBookings.find((b) => b.id === params.bookingId) ?? null
    : activeBookings[0] ?? null;

  if (!booking) return null;

  const moduleMetaMap = new Map(
    portalData.summary.modules.map((m) => [m.module.id, { code: m.module.moduleCode, title: m.module.title, order: m.module.sequenceOrder }]),
  );

  const grouped = new Map<
    string,
    {
      moduleCode: string;
      moduleTitle: string;
      order: number;
      papers: Array<{
        paperCode: string;
        paperName: string;
        isResit: boolean;
        paperStatus: KnecPaperResultStatus;
      }>;
    }
  >();

  for (const paper of booking.papers) {
    if (paper.paperStatus === 'cancelled') continue;
    const meta = moduleMetaMap.get(paper.moduleId);
    const modCode = meta?.code ?? paper.moduleCode;
    const entry = grouped.get(modCode) ?? {
      moduleCode: modCode,
      moduleTitle: meta?.title ?? `Module ${modCode}`,
      order: meta?.order ?? 99,
      papers: [],
    };
    entry.papers.push({
      paperCode: paper.paperCode,
      paperName: paper.paperName,
      isResit: paper.isResit,
      paperStatus: paper.paperStatus,
    });
    grouped.set(modCode, entry);
  }

  return {
    student: {
      id: portalData.summary.studentId,
      fullName: portalData.summary.fullName,
      admissionNumber: portalData.summary.admissionNumber,
      programmeCode: portalData.summary.programmeCode,
      programmeName: portalData.summary.programmeName,
      equivalentTrackLabel: portalData.summary.equivalentTrackLabel,
      departmentName: portalData.summary.departmentName,
      cohortName: portalData.summary.cohortName,
      knecIndexNumber: booking.knecIndexNumber ?? portalData.summary.knecIndexNumber,
    },
    booking,
    modulesSummary: Array.from(grouped.values()).sort((a, b) => a.order - b.order),
  };
}

export interface HodKnecDashboardData {
  departmentId: string;
  departmentName: string;
  series: KnecExamSeriesItem[];
  modules: KnecModuleItem[];
  students: StudentKnecSummary[];
}

export async function getHodKnecDashboardData(): Promise<HodKnecDashboardData | null> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return null;
  const admin = createAdminClient() as unknown as SupabaseClient;
  const departmentId = profile.activeDepartmentId;

  interface StudentQueryRow {
    id: string;
    admission_number: string;
    full_name: string;
    lifecycle_status: string;
    academic_phase: string;
    knec_index_number: string | null;
    kcse_index_number: string | null;
    national_id_number: string | null;
    phone_number: string | null;
    birth_certificate_entry_number: string | null;
    programme: Relation<{ id: string; code: string; name: string }>;
    current_cohort: Relation<{ id: string; name: string }>;
    admission_cohort: Relation<{ id: string; name: string }>;
  }

  const [catalog, studentRows, storedRows, bookingRows, bookingPaperRows] = await Promise.all([
    loadDepartmentKnecCatalog(admin, departmentId),
    fetchAll<StudentQueryRow>(
      () =>
        admin
          .from('students')
          .select(`
            id,admission_number,full_name,lifecycle_status,academic_phase,knec_index_number,
            kcse_index_number,national_id_number,phone_number,birth_certificate_entry_number,
            programme:programmes(id,code,name),
            current_cohort:cohorts!students_current_cohort_id_fkey(id,name),
            admission_cohort:cohorts!students_admission_cohort_id_fkey(id,name)
          `)
          .eq('department_id', departmentId)
          .order('full_name', { ascending: true }),
      'department students',
    ),
    fetchAll<StoredStatusRow>(
      () =>
        admin
          .from('student_knec_module_statuses')
          .select('student_id,module_id,status,completion_source,completed_series_id,knec_index_number,resit_paper_codes,notes')
          .eq('department_id', departmentId)
          .order('student_id', { ascending: true }),
      'department KNEC statuses',
    ),
    fetchAll<BookingRow>(
      () =>
        admin
          .from('student_knec_bookings')
          .select('id,student_id,series_id,knec_index_number,booking_type,booking_status,clearance_ref,submitted_at,hod_cleared_at,notes,created_at')
          .eq('department_id', departmentId)
          .order('created_at', { ascending: false }),
      'department KNEC bookings',
    ),
    fetchAll<BookingPaperRow>(
      () =>
        admin
          .from('student_knec_booking_papers')
          .select('id,booking_id,student_id,series_id,module_id,paper_id,paper_code,paper_name,is_resit,paper_status,grade,remarks')
          .eq('department_id', departmentId)
          .order('paper_code', { ascending: true }),
      'department KNEC booking papers',
    ),
  ]);

  const seriesMap = new Map(catalog.series.map((s) => [s.id, s]));
  const allBookings = hydrateBookings(bookingRows, bookingPaperRows, seriesMap, catalog.moduleCodeById);

  const bookingsByStudent = new Map<string, KnecBookingRecord[]>();
  for (const b of allBookings) {
    bookingsByStudent.set(b.studentId, [...(bookingsByStudent.get(b.studentId) ?? []), b]);
  }

  const statusesByStudent = new Map<string, StoredModuleStatusInput[]>();
  for (const s of storedRows) {
    const list = statusesByStudent.get(s.student_id) ?? [];
    list.push({
      moduleId: s.module_id,
      status: s.status,
      completionSource: s.completion_source,
      completedSeriesName: s.completed_series_id ? seriesMap.get(s.completed_series_id)?.seriesName ?? null : null,
      resitPaperCodes: s.resit_paper_codes ?? [],
      notes: s.notes,
    });
    statusesByStudent.set(s.student_id, list);
  }

  const students: StudentKnecSummary[] = studentRows.map((row) => {
    const prog = one(row.programme);
    const currentCohort = one(row.current_cohort);
    const admissionCohort = one(row.admission_cohort);
    const progCode = (prog?.code ?? '').trim().toUpperCase();
    const stuBookings = bookingsByStudent.get(row.id) ?? [];
    const stuModules = catalog.modulesByProgCode.get(progCode) ?? [];

    const progress = deriveStudentKnecProgress({
      modules: stuModules,
      storedStatuses: statusesByStudent.get(row.id) ?? [],
      bookings: stuBookings,
    });

    const latestBookingIndex = stuBookings.find((b) => Boolean(b.knecIndexNumber))?.knecIndexNumber ?? null;
    const missingProfileFields = getMissingKnecBiodataFields({
      kcseIndexNumber: row.kcse_index_number,
      nationalIdNumber: row.national_id_number,
      phoneNumber: row.phone_number,
      birthCertificateEntryNumber: row.birth_certificate_entry_number,
    });

    return {
      studentId: row.id,
      admissionNumber: row.admission_number,
      fullName: row.full_name,
      programmeId: prog?.id ?? null,
      programmeCode: progCode,
      programmeName: prog?.name ?? progCode,
      equivalentTrackLabel: canonicalKnecTrackLabel(progCode),
      departmentName: profile.departmentName,
      cohortName: currentCohort?.name ?? admissionCohort?.name ?? null,
      lifecycleStatus: row.lifecycle_status,
      academicPhase: row.academic_phase,
      knecIndexNumber: row.knec_index_number ?? latestBookingIndex,
      missingProfileFields,
      modules: progress.items,
      bookings: stuBookings,
      requiredCount: progress.requiredCount,
      completedCount: progress.completedCount,
      resitCount: progress.resitCount,
      bookedCount: progress.bookedCount,
      pendingCount: progress.pendingCount,
      completionPercent: progress.completionPercent,
      overallStatus: progress.overallStatus,
    };
  });

  return {
    departmentId,
    departmentName: profile.departmentName,
    series: catalog.series,
    modules: catalog.allModules,
    students,
  };
}
