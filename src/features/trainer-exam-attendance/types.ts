export interface TrainerAttendanceUnit {
  assessmentId: string;
  unitCode: string;
  unitName: string;
  academicPeriodName: string;
  expectedStudents: number;
  absentStudents: number;
  attendanceFinalizedAt: string | null;
  examMarksFinalizedAt: string | null;
}

export interface TrainerAttendanceStudent {
  id: string;
  admissionNumber: string;
  fullName: string;
  cohortName: string;
  isAbsent: boolean;
}

export interface TrainerAttendanceWorkspace {
  assessmentId: string;
  unitCode: string;
  unitName: string;
  academicPeriodName: string;
  trainerName: string;
  attendanceFinalizedAt: string | null;
  examMarksFinalizedAt: string | null;
  students: TrainerAttendanceStudent[];
}
