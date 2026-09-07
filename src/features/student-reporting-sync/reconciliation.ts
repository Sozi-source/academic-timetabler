import { createClient } from '@/lib/supabase/server';
import type {
  RawReportingRow,
  ReconciledReportingItem,
  ReportingSyncPreviewResult,
  ReportingSyncSummary,
} from './types';

/**
 * Normalizes admission number strings for resilient index matching.
 * e.g. "chn / s - 4184 / ic / 24" -> "CHN/S-4184/IC/24"
 */
export function normalizeAdmissionKey(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}

/**
 * Reconciles parsed raw reporting rows against department students and active academic period reporting records.
 */
export async function reconcileReportingRows(
  rawRows: RawReportingRow[],
  activeDepartmentId: string,
): Promise<ReportingSyncPreviewResult> {
  const supabase = await createClient();

  // 1. Fetch active academic period
  const { data: period, error: periodErr } = await supabase
    .from('academic_periods')
    .select('id, code, name')
    .eq('status', 'active')
    .maybeSingle();

  if (periodErr) {
    throw new Error(`Failed to load active academic period: ${periodErr.message}`);
  }

  // 2. Fetch all department students
  const { data: students, error: studentErr } = await supabase
    .from('students')
    .select(`
      id,
      admission_number,
      full_name,
      lifecycle_status,
      current_cohort:cohorts!students_current_cohort_id_fkey(name),
      programme:programmes!students_programme_id_fkey(code)
    `)
    .eq('department_id', activeDepartmentId);

  if (studentErr) {
    throw new Error(`Failed to load department students: ${studentErr.message}`);
  }

  // 3. Fetch period reporting records if active period exists
  const reportedStudentIds = new Set<string>();
  if (period) {
    const { data: reportings } = await supabase
      .from('student_period_reporting')
      .select('student_id, reporting_status')
      .eq('academic_period_id', period.id)
      .eq('reporting_status', 'reported');

    for (const r of reportings || []) {
      reportedStudentIds.add(r.student_id);
    }
  }

  // Build lookup maps by normalized admission number
  const studentMap = new Map<string, (typeof students)[0]>();
  for (const s of students || []) {
    studentMap.set(normalizeAdmissionKey(s.admission_number), s);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const items: ReconciledReportingItem[] = [];
  const seenAdmissionNumbers = new Set<string>();

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const normAdm = normalizeAdmissionKey(row.admissionNumber);

    // Skip duplicates within the imported list
    if (seenAdmissionNumbers.has(normAdm)) continue;
    seenAdmissionNumbers.add(normAdm);

    const student = studentMap.get(normAdm);
    const dateVal = row.reportedOn && /^\d{4}-\d{2}-\d{2}$/.test(row.reportedOn) ? row.reportedOn : todayStr;

    if (!student) {
      items.push({
        id: `unmatched-${i}-${normAdm}`,
        admissionNumber: row.admissionNumber,
        reportedOn: dateVal,
        matchState: 'unmatched',
        matchReason: 'Admission number not found in department roster',
      });
      continue;
    }

    const cohort = Array.isArray(student.current_cohort) ? student.current_cohort[0] : student.current_cohort;
    const programme = Array.isArray(student.programme) ? student.programme[0] : student.programme;
    const isAlreadyReported = reportedStudentIds.has(student.id) && student.lifecycle_status === 'active';

    if (isAlreadyReported) {
      items.push({
        id: `reported-${student.id}`,
        studentId: student.id,
        admissionNumber: student.admission_number,
        studentName: student.full_name,
        cohortName: cohort?.name ?? 'No cohort',
        programmeCode: programme?.code ?? '-',
        currentLifecycleStatus: student.lifecycle_status,
        reportedOn: dateVal,
        matchState: 'already_reported',
        matchReason: 'Already confirmed reported and active for this period',
      });
    } else {
      items.push({
        id: `ready-${student.id}`,
        studentId: student.id,
        admissionNumber: student.admission_number,
        studentName: student.full_name,
        cohortName: cohort?.name ?? 'No cohort',
        programmeCode: programme?.code ?? '-',
        currentLifecycleStatus: student.lifecycle_status,
        reportedOn: dateVal,
        matchState: 'ready',
        matchReason:
          student.lifecycle_status === 'admitted'
            ? 'Admitted student ready for activation'
            : student.lifecycle_status === 'deferred'
              ? 'Deferred student returning to active study'
              : 'Reporting confirmation ready',
      });
    }
  }

  const summary: ReportingSyncSummary = {
    totalRows: items.length,
    readyCount: items.filter((x) => x.matchState === 'ready').length,
    alreadyReportedCount: items.filter((x) => x.matchState === 'already_reported').length,
    unmatchedCount: items.filter((x) => x.matchState === 'unmatched').length,
  };

  return {
    success: true,
    academicPeriod: period,
    summary,
    items,
  };
}
