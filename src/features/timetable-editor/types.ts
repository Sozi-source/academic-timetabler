export type EditorActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
};

export const initialEditorActionState: EditorActionState = {
  status: 'idle',
  message: null,
};

export interface EditorSession {
  id: string;
  academicPeriodId: string;
  workingDayId: string;
  startTimeSlotId: string;
  endTimeSlotId: string;
  roomId: string | null;
  status: 'draft' | 'confirmed' | 'locked';
  source: 'manual' | 'generator' | 'import' | 'reschedule';
  conflictState: 'unchecked' | 'clear' | 'warning' | 'blocked';
  isLocked: boolean;
  notes: string | null;
  sessionNumber: number;
  cohortCode: string;
  cohortName: string;
  cohortSize: number;
  participantCohorts: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  unitName: string;
  unitCode: string;
  trainerId: string | null;
  trainerName: string;
  trainerTargetHours: number;
  roomName: string;
  roomCode: string | null;
}

export interface EditorOption {
  id: string;
  label: string;
}

export interface EditorTrainer {
  id: string;
  fullName: string;
  staffNumber: string;
  homeDepartment: string | null;
  departmentId: string | null;
  normalWeeklyHours: number;
  workloadRole: string;
  allocatedHours: number;
}

export interface EditorData {
  sessions: EditorSession[];
  missingAllocations: Array<{
    id: string;
    unitCode: string;
    unitName: string;
    cohortCode: string;
    trainerName: string;
    cohortId: string;
    unitId: string;
    trainerId: string | null;
    missingSessionCount: number;
    expectedSessionCount: number;
  }>;
  workingDays: Array<EditorOption & { sequenceNumber: number }>;
  timeSlots: Array<EditorOption & { startsAt: string; endsAt: string; sequenceNumber: number }>;
  rooms: Array<EditorOption & { name: string; capacity: number }>;
  trainers: EditorTrainer[];
  profile: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    departmentName: string;
    activeDepartmentId: string | null;
    isActive: boolean;
  } | null;
}
