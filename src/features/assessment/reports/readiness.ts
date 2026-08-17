import type { AssessmentPeriodReportData } from './queries';

export interface AssessmentReportReadiness {
  totalRows: number;
  unitCount: number;
  studentCount: number;
  catMarkedRows: number;
  catMissingRows: number;
  examFinalRows: number;
  examAttendanceRecordedRows: number;
  examAttendancePendingRows: number;
  catReady: boolean;
  examReady: boolean;
}

export function getAssessmentReportReadiness(data: AssessmentPeriodReportData): AssessmentReportReadiness {
  const unitCount = new Set(data.rows.map((row) => row.unitId)).size;
  const studentCount = new Set(data.rows.map((row) => row.studentId)).size;
  const catMarkedRows = data.rows.filter((row) => row.cat1 !== null).length;
  const catMissingRows = data.rows.filter((row) => row.cat1 === null).length;
  const examFinalRows = data.rows.filter((row) => row.attendance === 'absent' || row.total !== null).length;
  const examAttendanceRecordedRows = data.rows.filter((row) => row.attendance !== 'pending').length;
  const examAttendancePendingRows = data.rows.filter((row) => row.attendance === 'pending').length;

  return {
    totalRows: data.rows.length,
    unitCount,
    studentCount,
    catMarkedRows,
    catMissingRows,
    examFinalRows,
    examAttendanceRecordedRows,
    examAttendancePendingRows,
    catReady: data.rows.length > 0 && catMarkedRows > 0,
    examReady:
      data.rows.length > 0 &&
      examAttendanceRecordedRows > 0 &&
      examAttendancePendingRows === 0 &&
      examFinalRows > 0,
  };
}
