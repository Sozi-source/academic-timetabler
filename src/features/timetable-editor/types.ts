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
  roomId: string;
  status: 'draft' | 'confirmed' | 'locked';
  source: 'manual' | 'generator' | 'import' | 'reschedule';
  conflictState: 'unchecked' | 'clear' | 'warning' | 'blocked';
  isLocked: boolean;
  notes: string | null;
  sessionNumber: number;
  cohortName: string;
  cohortSize: number;
  unitName: string;
  unitCode: string;
  trainerName: string;
  roomName: string;
  roomCode: string;
}

export interface EditorOption {
  id: string;
  label: string;
}

export interface EditorData {
  sessions: EditorSession[];
  workingDays: Array<EditorOption & { sequenceNumber: number }>;
  timeSlots: Array<EditorOption & { startsAt: string; endsAt: string; sequenceNumber: number }>;
  rooms: Array<EditorOption & { capacity: number }>;
}
