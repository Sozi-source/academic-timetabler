import type {
  ClassAttendanceStatus,
  ClassSessionStatus,
} from './types';

export interface DepartmentAttendanceSession {
  classSessionId:
    string;
  teachingAllocationId:
    string;
  sessionDate:
    string;
  sessionStatus:
    ClassSessionStatus;
  academicPeriodName:
    string;
  unitName:
    string;
  cohortNames:
    string;
  trainerName:
    string;
  startsAt:
    string;
  endsAt:
    string;
  studentCount:
    number;
  presentCount:
    number;
  absentCount:
    number;
  unmarkedCount:
    number;
}

export interface DepartmentAttendanceStudent {
  studentId:
    string;
  admissionNumber:
    string;
  fullName:
    string;
  cohortName:
    string;
  attendanceStatus:
    ClassAttendanceStatus;
  note:
    string |
    null;
}

export interface DepartmentAttendanceWorkspace {
  classSessionId:
    string;
  sessionDate:
    string;
  sessionStatus:
    ClassSessionStatus;
  academicPeriodName:
    string;
  unitName:
    string;
  cohortNames:
    string;
  trainerName:
    string;
  startsAt:
    string;
  endsAt:
    string;
  students:
    DepartmentAttendanceStudent[];
}

export interface HodClassAttendanceItem {
  classSessionId:
    string;
  teachingAllocationId:
    string;
  sessionDate:
    string;
  status:
    ClassSessionStatus;
  academicPeriodName:
    string;
  unitName:
    string;
  cohortName:
    string;
  trainerName:
    string;
  startsAt:
    string;
  endsAt:
    string;
  rosterCount:
    number;
  presentCount:
    number;
  absentCount:
    number;
  unmarkedCount:
    number;
  completedAt:
    string |
    null;
  reopenedAt:
    string |
    null;
}

export interface HodClassAttendanceStudent {
  studentId:
    string;
  admissionNumber:
    string;
  fullName:
    string;
  attendanceStatus:
    ClassAttendanceStatus;
  note:
    string |
    null;
}

export interface HodClassAttendanceWorkspace {
  classSessionId:
    string;
  teachingAllocationId:
    string;
  sessionDate:
    string;
  sessionStatus:
    ClassSessionStatus;
  academicPeriodName:
    string;
  unitName:
    string;
  cohortName:
    string;
  trainerName:
    string;
  startsAt:
    string;
  endsAt:
    string;
  rosterCount:
    number;
  students:
    HodClassAttendanceStudent[];
}
