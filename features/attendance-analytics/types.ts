export interface DepartmentAttendanceAggregate {
  academicPeriodId: string;
  academicPeriodName: string;
  cohortId: string;
  cohortName: string;
  unitId: string;
  unitName: string;
  trainerId: string;
  trainerName: string;
  completedSessions: number;
  rosterOccurrences: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number | null;
}

export interface StudentAttendanceAggregate {
  academicPeriodId: string;
  academicPeriodName: string;
  studentId: string;
  admissionNumber: string;
  fullName: string;
  cohortId: string;
  cohortName: string;
  unitId: string;
  unitName: string;
  completedSessions: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number | null;
}

export interface StudentPortalAttendanceSession {
  classSessionId: string;
  sessionDate: string;
  unitId: string;
  unitName: string;
  cohortName: string;
  academicPeriodName: string;
  startsAt: string;
  endsAt: string;
  status: 'present' | 'absent';
}

export interface StudentPortalAttendanceUnit {
  unitId: string;
  unitName: string;
  completedSessions: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number | null;
}

export interface StudentPortalAttendanceSnapshot {
  periodName: string | null;
  completedSessions: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number | null;
  units: StudentPortalAttendanceUnit[];
  sessions: StudentPortalAttendanceSession[];
}
