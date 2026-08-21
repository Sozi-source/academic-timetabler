export type ClassAttendanceStatus =
  | 'unmarked'
  | 'present'
  | 'absent';

export type ClassSessionStatus =
  | 'open'
  | 'completed'
  | 'cancelled';

export interface ClassAttendanceScheduleItem {
  scheduledSessionId:
    string;
  teachingAllocationId:
    string;
  academicPeriodId:
    string;
  academicPeriodName:
    string;
  cohortId:
    string;
  cohortName:
    string;
  unitId:
    string;
  unitName:
    string;
  dayOfWeek:
    string;
  daySequence:
    number;
  startsAt:
    string;
  endsAt:
    string;
  sessionNumber:
    number;
  teachingStartsOn:
    string;
  teachingEndsOn:
    string;
  latestClassSessionId:
    string |
    null;
  latestSessionDate:
    string |
    null;
  latestStatus:
    ClassSessionStatus |
    null;
}

export interface ClassAttendanceHistoryItem {
  classSessionId:
    string;
  teachingAllocationId:
    string;
  sessionDate:
    string;
  status:
    ClassSessionStatus;
  unitName:
    string;
  cohortName:
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
}

export interface ClassAttendanceStudent {
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

export interface ClassAttendanceWorkspace {
  classSessionId:
    string;
  teachingAllocationId:
    string;
  scheduledSessionId:
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
  startsAt:
    string;
  endsAt:
    string;
  rosterCount:
    number;
  students:
    ClassAttendanceStudent[];
}
