export type ConstraintSubjectType =
  | 'trainer'
  | 'room'
  | 'cohort'
  | 'institution';

export type ConstraintType =
  | 'unavailable'
  | 'preferred'
  | 'required'
  | 'protected_day';

export type ConstraintPriority = 'hard' | 'soft';

export interface ConstraintOption {
  id: string;
  label: string;
}

export interface WorkingDayOption extends ConstraintOption {
  sequenceNumber: number;
}

export interface TimeSlotOption extends ConstraintOption {
  startsAt: string;
  endsAt: string;
  sequenceNumber: number;
}

export interface SchedulingConstraint {
  id: string;
  academicPeriodId: string;
  subjectType: ConstraintSubjectType;
  subjectId: string | null;
  subjectLabel: string;
  constraintType: ConstraintType;
  workingDayId: string | null;
  workingDayLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: ConstraintPriority;
  reason: string;
  isActive: boolean;
}

export type CalendarEventType =
  | 'holiday'
  | 'cat_exam'
  | 'seminar'
  | 'field_trip'
  | 'custom';

export interface TimetableCalendarEvent {
  id: string;
  academicPeriodId: string;
  title: string;
  eventType: CalendarEventType;
  eventDate: string;
  startsAt: string | null;
  endsAt: string | null;
  scopeType: ConstraintSubjectType;
  scopeId: string | null;
  scopeLabel: string;
  suspendsRegularClasses: boolean;
  notes: string | null;
  isActive: boolean;
}

export interface SchedulingConstraintData {
  constraints: SchedulingConstraint[];
  calendarEvents: TimetableCalendarEvent[];
  trainers: ConstraintOption[];
  rooms: ConstraintOption[];
  cohorts: ConstraintOption[];
  workingDays: WorkingDayOption[];
  timeSlots: TimeSlotOption[];
}
