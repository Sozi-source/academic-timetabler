export interface StudentUnitAttendanceScore {
  unitId: string;
  unitCode: string;
  unitName: string;
  completedSessions: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number | null; // e.g. 88.5% or null if no marked sessions
}

export interface StudentAttendanceScorecardItem {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  cohortId: string;
  cohortName: string;
  programmeCode: string;
  programmeName: string;
  units: StudentUnitAttendanceScore[];
  totalCompletedSessions: number;
  totalPresent: number;
  totalAbsent: number;
  overallScore: number | null; // e.g. 88.5%
  standing: 'good' | 'borderline' | 'at_risk' | 'unrecorded';
}

export interface AttendanceScorecardCohortOption {
  id: string;
  name: string;
  code: string;
  studentCount: number;
}

export interface AttendanceScorecardUnitColumn {
  id: string;
  code: string;
  name: string;
}

export interface StudentAttendanceScorecardData {
  academicPeriodId: string;
  academicPeriodName: string;
  students: StudentAttendanceScorecardItem[];
  cohorts: AttendanceScorecardCohortOption[];
  allUnits: AttendanceScorecardUnitColumn[];
  stats: {
    totalStudents: number;
    averageAttendanceRate: number;
    goodStandingCount: number;
    borderlineCount: number;
    atRiskCount: number;
    unrecordedCount: number;
  };
}
