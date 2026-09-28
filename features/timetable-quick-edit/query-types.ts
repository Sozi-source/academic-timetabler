import type { EditorOption } from '../timetable-editor/types';

export interface QuickEditSessionIdentity {
  id: string;
  academicPeriodId: string;
  workingDayId: string;
  startTimeSlotId: string;
  endTimeSlotId: string;
  roomId: string | null;
  trainerId: string | null;
  isLocked: boolean;
  status: 'draft' | 'confirmed' | 'locked';
  cohortCode: string;
  unitCode: string;
  unitName: string;
  trainerName: string;
  roomName: string;
  dayLabel: string;
  timeLabel: string;
}

export interface QuickEditRoomOption extends EditorOption {
  capacity: number;
}

export interface QuickEditTrainerOption extends EditorOption {
  fullName: string;
}

/**
 * Only ever holds the options for the ONE field being edited — see
 * changes.md "No modal stacking". A schedule edit never carries room or
 * trainer lists it doesn't need, and vice versa.
 */
export type QuickEditOptions =
  | { field: 'schedule'; workingDays: EditorOption[]; timeSlots: Array<EditorOption & { startsAt: string; endsAt: string }> }
  | { field: 'room'; rooms: QuickEditRoomOption[] }
  | { field: 'trainer'; trainers: QuickEditTrainerOption[] };
