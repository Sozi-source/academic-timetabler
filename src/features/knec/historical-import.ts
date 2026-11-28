import type { SupabaseClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

import { parseHistoricalProgressSheetRow, type ParsedHistoricalKnecRow } from './domain';

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('result' in value) return cellToString(value.result as ExcelJS.CellValue);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
  }
  return String(value).trim();
}

export async function parseHistoricalKnecProgressWorkbook(
  buffer: ArrayBuffer | Buffer | Uint8Array,
): Promise<ParsedHistoricalKnecRow[]> {
  const wb = new ExcelJS.Workbook();
  const nodeBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(new Uint8Array(buffer));
  await wb.xlsx.load(nodeBuf as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const ws = wb.worksheets[0];
  if (!ws) return [];

  const parsed: ParsedHistoricalKnecRow[] = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const cells = Array.from({ length: 13 }, (_, idx) => cellToString(row.getCell(idx + 1).value));
    if (!cells.some(Boolean)) continue;
    const item = parseHistoricalProgressSheetRow(cells);
    if (item) parsed.push(item);
  }
  return parsed;
}

export interface KnecHistoricalImportSummary {
  totalRows: number;
  matchedStudents: number;
  unmatchedAdmissionNumbers: string[];
  moduleStatusRecordsUpserted: number;
  nov2026BookingsUpserted: number;
  nov2026PaperRecordsUpserted: number;
  omittedCompletedInitialized: number;
}

export async function applyHistoricalKnecProgressImport(params: {
  admin: SupabaseClient;
  departmentId: string;
  rows: ParsedHistoricalKnecRow[];
  initializeOmittedCompletedStudents?: boolean;
  actorId?: string | null;
}): Promise<KnecHistoricalImportSummary> {
  const { admin, departmentId, rows, initializeOmittedCompletedStudents = true, actorId = null } = params;

  const [{ data: students }, { data: modules }, { data: papers }, { data: rules }, { data: seriesRows }] =
    await Promise.all([
      admin
        .from('students')
        .select('id, admission_number, lifecycle_status, academic_phase, programme:programmes(id, code)')
        .eq('department_id', departmentId),
      admin
        .from('knec_modules')
        .select('id, module_code, title')
        .eq('department_id', departmentId),
      admin
        .from('knec_papers')
        .select('id, module_id, paper_code, paper_name')
        .eq('department_id', departmentId),
      admin
        .from('knec_programme_module_rules')
        .select('programme_code, module_id')
        .eq('department_id', departmentId),
      admin
        .from('knec_exam_series')
        .select('id, series_code, series_name')
        .eq('department_id', departmentId),
    ]);

  const studentByAdm = new Map<
    string,
    { id: string; admissionNumber: string; lifecycleStatus: string; academicPhase: string; programmeCode: string }
  >();
  for (const s of students ?? []) {
    const prog = Array.isArray(s.programme) ? s.programme[0] : s.programme;
    studentByAdm.set(String(s.admission_number).trim().toLowerCase(), {
      id: String(s.id),
      admissionNumber: String(s.admission_number).trim(),
      lifecycleStatus: String(s.lifecycle_status ?? ''),
      academicPhase: String(s.academic_phase ?? ''),
      programmeCode: String((prog as { code?: string } | null)?.code ?? '').toUpperCase(),
    });
  }

  const moduleIdByCode = new Map<string, string>();
  const moduleCodeById = new Map<string, string>();
  for (const m of modules ?? []) {
    const code = String(m.module_code).trim();
    moduleIdByCode.set(code, String(m.id));
    moduleCodeById.set(String(m.id), code);
  }

  const paperByCode = new Map<string, { id: string; moduleId: string; paperCode: string; paperName: string }>();
  const papersByModuleId = new Map<string, Array<{ id: string; paperCode: string; paperName: string }>>();
  for (const p of papers ?? []) {
    const item = {
      id: String(p.id),
      moduleId: String(p.module_id),
      paperCode: String(p.paper_code).trim(),
      paperName: String(p.paper_name).trim(),
    };
    paperByCode.set(item.paperCode, item);
    papersByModuleId.set(item.moduleId, [...(papersByModuleId.get(item.moduleId) ?? []), item]);
  }

  const ruleModuleIdsByProg = new Map<string, string[]>();
  for (const r of rules ?? []) {
    const pCode = String(r.programme_code).trim().toUpperCase();
    ruleModuleIdsByProg.set(pCode, [...(ruleModuleIdsByProg.get(pCode) ?? []), String(r.module_id)]);
  }

  const nov2026Series = (seriesRows ?? []).find(
    (s) => s.series_code === 'NOV-2026' || String(s.series_name).toLowerCase() === 'november 2026',
  );

  const moduleStatusesToUpsert: Array<Record<string, unknown>> = [];
  const bookingsToUpsert: Array<{
    row: ParsedHistoricalKnecRow;
    studentId: string;
    bookingType: 'normal' | 'resit' | 'mixed' | 'historical';
    bookedModuleCodes: string[];
  }> = [];

  const matchedStudentIds = new Set<string>();
  const unmatchedAdmissionNumbers: string[] = [];

  for (const row of rows) {
    const stu = studentByAdm.get(row.admissionNumber.trim().toLowerCase());
    if (!stu) {
      unmatchedAdmissionNumbers.push(row.admissionNumber);
      continue;
    }
    matchedStudentIds.add(stu.id);

    const pendingMap = new Map(row.pendingModules.map((p) => [p.moduleCode, p.isResit]));
    const regNovSet = new Set(row.registeredNov2026Modules);
    const requiredCodes =
      row.requiredModules.length > 0
        ? row.requiredModules
        : (ruleModuleIdsByProg.get(row.programmeCode || stu.programmeCode) ?? [])
            .map((id) => moduleCodeById.get(id))
            .filter((code): code is string => Boolean(code));

    for (const moduleCode of requiredCodes) {
      const moduleId = moduleIdByCode.get(moduleCode);
      if (!moduleId) continue;

      const isPending = pendingMap.has(moduleCode);
      const isResit = Boolean(pendingMap.get(moduleCode));
      const isBookedNov = regNovSet.has(moduleCode);

      const status = isBookedNov
        ? 'booked'
        : isPending
          ? isResit
            ? 'resit'
            : 'pending'
          : 'completed';

      const resitPaperCodes = isResit ? (row.nov2026PapersByModule[moduleCode] ?? []) : [];

      moduleStatusesToUpsert.push({
        student_id: stu.id,
        module_id: moduleId,
        department_id: departmentId,
        status,
        completion_source: 'historical_import',
        resit_paper_codes: resitPaperCodes,
        notes: row.actionLabel || null,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      });
    }

    if (row.registeredNov2026Modules.length > 0 && nov2026Series) {
      const hasResit = row.registeredNov2026Modules.some((code) => Boolean(pendingMap.get(code)));
      const hasNormal = row.registeredNov2026Modules.some((code) => !pendingMap.get(code));
      const bookingType = hasResit && hasNormal ? 'mixed' : hasResit ? 'resit' : 'normal';
      bookingsToUpsert.push({
        row,
        studentId: stu.id,
        bookingType,
        bookedModuleCodes: row.registeredNov2026Modules,
      });
    }
  }

  let omittedCompletedInitialized = 0;
  if (initializeOmittedCompletedStudents) {
    for (const stu of studentByAdm.values()) {
      if (matchedStudentIds.has(stu.id)) continue;
      if (!['graduated', 'completed'].includes(stu.lifecycleStatus)) continue;
      const modIds = ruleModuleIdsByProg.get(stu.programmeCode) ?? [];
      for (const moduleId of modIds) {
        moduleStatusesToUpsert.push({
          student_id: stu.id,
          module_id: moduleId,
          department_id: departmentId,
          status: 'completed',
          completion_source: 'historical_import',
          resit_paper_codes: [],
          notes: 'Baseline completed (not in Pending KNEC sheet)',
          updated_by: actorId,
          updated_at: new Date().toISOString(),
        });
      }
      if (modIds.length > 0) omittedCompletedInitialized += 1;
    }
  }

  // Upsert module statuses in chunks
  for (let i = 0; i < moduleStatusesToUpsert.length; i += 250) {
    const chunk = moduleStatusesToUpsert.slice(i, i + 250);
    const { error } = await admin
      .from('student_knec_module_statuses')
      .upsert(chunk, { onConflict: 'student_id,module_id' });
    if (error) {
      throw new Error(`Failed to upsert KNEC module statuses: ${error.message}`);
    }
  }

  let nov2026BookingsUpserted = 0;
  let nov2026PaperRecordsUpserted = 0;

  if (nov2026Series && bookingsToUpsert.length > 0) {
    const bookingPayload = bookingsToUpsert.map((item) => ({
      department_id: departmentId,
      student_id: item.studentId,
      series_id: nov2026Series.id,
      booking_type: item.bookingType,
      booking_status: 'registered_knec',
      clearance_ref: `ICMHS/KNEC/NOV-2026/${item.row.admissionNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-6)}`,
      notes: item.row.actionLabel || 'Seeded from Students KNEC Progress.xlsx',
      updated_at: new Date().toISOString(),
    }));

    const { data: upsertedBookings, error: bookingError } = await admin
      .from('student_knec_bookings')
      .upsert(bookingPayload, { onConflict: 'student_id,series_id' })
      .select('id, student_id');

    if (bookingError) {
      throw new Error(`Failed to upsert Nov 2026 bookings: ${bookingError.message}`);
    }

    nov2026BookingsUpserted = upsertedBookings?.length ?? 0;
    const bookingIdByStudent = new Map<string, string>();
    for (const b of upsertedBookings ?? []) {
      bookingIdByStudent.set(String(b.student_id), String(b.id));
    }

    const bookingPapersPayload: Array<Record<string, unknown>> = [];
    for (const item of bookingsToUpsert) {
      const bookingId = bookingIdByStudent.get(item.studentId);
      if (!bookingId) continue;

      const pendingMap = new Map(item.row.pendingModules.map((p) => [p.moduleCode, p.isResit]));

      for (const moduleCode of item.bookedModuleCodes) {
        const moduleId = moduleIdByCode.get(moduleCode);
        if (!moduleId) continue;
        const explicitCodes = item.row.nov2026PapersByModule[moduleCode] ?? [];
        const fallbackPapers = (papersByModuleId.get(moduleId) ?? []).map((p) => p.paperCode);
        const paperCodes = explicitCodes.length > 0 ? explicitCodes : fallbackPapers;
        const isPartialResit = fallbackPapers.length > 0 && paperCodes.length < fallbackPapers.length;
        const isResit = Boolean(pendingMap.get(moduleCode)) || isPartialResit;

        for (const paperCode of paperCodes) {
          const catalogPaper = paperByCode.get(paperCode);
          bookingPapersPayload.push({
            booking_id: bookingId,
            department_id: departmentId,
            student_id: item.studentId,
            series_id: nov2026Series.id,
            module_id: moduleId,
            paper_id: catalogPaper?.id ?? null,
            paper_code: paperCode,
            paper_name: catalogPaper?.paperName ?? `KNEC Paper ${paperCode}`,
            is_resit: isResit,
            paper_status: 'booked',
          });
        }
      }
    }

    for (let i = 0; i < bookingPapersPayload.length; i += 250) {
      const chunk = bookingPapersPayload.slice(i, i + 250);
      const { error: paperErr } = await admin
        .from('student_knec_booking_papers')
        .upsert(chunk, { onConflict: 'booking_id,paper_code' });
      if (paperErr) {
        throw new Error(`Failed to upsert Nov 2026 booked papers: ${paperErr.message}`);
      }
      nov2026PaperRecordsUpserted += chunk.length;
    }
  }

  return {
    totalRows: rows.length,
    matchedStudents: matchedStudentIds.size,
    unmatchedAdmissionNumbers,
    moduleStatusRecordsUpserted: moduleStatusesToUpsert.length,
    nov2026BookingsUpserted,
    nov2026PaperRecordsUpserted,
    omittedCompletedInitialized,
  };
}
