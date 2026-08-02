import type {
  DetectTimetableConflictsInput,
  PlanningSession,
} from '@/features/timetable-generator';

export const baseSession:
PlanningSession = {
  id: 'session-1',
  academicPeriodId: 'period-1',
  teachingAllocationId:
    'allocation-1',
  cohortId: 'cohort-1',
  unitId: 'unit-1',
  trainerId: 'trainer-1',
  workingDayId: 'day-1',
  startTimeSlotId: 'slot-1',
  endTimeSlotId: 'slot-2',
  roomId: 'room-1',
  sessionNumber: 1,
  deliveryMode: 'theory',
  status: 'draft',
  source: 'generator',
  conflictState: 'unchecked',
  isLocked: false,
};

export function createConflictInput(
  sessions: PlanningSession[] = [
    baseSession,
  ],
): DetectTimetableConflictsInput {
  return {
    sessions,
    workingDays: [
      {
        id: 'day-1',
        academicPeriodId:
          'period-1',
        dayOfWeek: 'monday',
        sequenceNumber: 1,
        isEnabled: true,
      },
      {
        id: 'day-2',
        academicPeriodId:
          'period-1',
        dayOfWeek: 'tuesday',
        sequenceNumber: 2,
        isEnabled: true,
      },
    ],
    timeSlots: [
      {
        id: 'slot-1',
        academicPeriodId:
          'period-1',
        code: 'S1',
        name: '08:00–09:00',
        slotType: 'teaching',
        startsAt: '08:00:00',
        endsAt: '09:00:00',
        sequenceNumber: 1,
        isEnabled: true,
      },
      {
        id: 'slot-2',
        academicPeriodId:
          'period-1',
        code: 'S2',
        name: '09:00–10:00',
        slotType: 'teaching',
        startsAt: '09:00:00',
        endsAt: '10:00:00',
        sequenceNumber: 2,
        isEnabled: true,
      },
      {
        id: 'slot-3',
        academicPeriodId:
          'period-1',
        code: 'S3',
        name: '10:00–11:00',
        slotType: 'teaching',
        startsAt: '10:00:00',
        endsAt: '11:00:00',
        sequenceNumber: 3,
        isEnabled: true,
      },
    ],
    trainers: [
      {
        id: 'trainer-1',
        staffNumber: 'TR-001',
        fullName: 'Trainer One',
        maximumWeeklyHours: 24,
        maximumDailyHours: 6,
        isActive: true,
        isTimetableAvailable: true,
      },
      {
        id: 'trainer-2',
        staffNumber: 'TR-002',
        fullName: 'Trainer Two',
        maximumWeeklyHours: 24,
        maximumDailyHours: 6,
        isActive: true,
        isTimetableAvailable: true,
      },
    ],
    cohorts: [
      {
        id: 'cohort-1',
        code: 'COH-1',
        name: 'Cohort One',
        actualSize: 30,
        isTimetableAvailable: true,
      },
      {
        id: 'cohort-2',
        code: 'COH-2',
        name: 'Cohort Two',
        actualSize: 20,
        isTimetableAvailable: true,
      },
    ],
    rooms: [
      {
        id: 'room-1',
        code: 'R-1',
        name: 'Room One',
        roomType: 'lecture_room',
        capacity: 40,
        isActive: true,
        isTimetableAvailable: true,
      },
      {
        id: 'room-2',
        code: 'LAB-1',
        name: 'Laboratory One',
        roomType: 'laboratory',
        capacity: 25,
        isActive: true,
        isTimetableAvailable: true,
      },
    ],
    units: [
      {
        id: 'unit-1',
        code: 'NUT-101',
        name: 'Nutrition One',
        preferredRoomType:
          'lecture_room',
        isActive: true,
        isTimetableAvailable: true,
      },
      {
        id: 'unit-2',
        code: 'NUT-102',
        name: 'Nutrition Two',
        preferredRoomType: null,
        isActive: true,
        isTimetableAvailable: true,
      },
    ],
  };
}