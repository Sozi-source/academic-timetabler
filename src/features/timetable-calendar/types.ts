export type WeekdayCode =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type TimeSlotType =
  | 'teaching'
  | 'break'
  | 'lunch'
  | 'assembly'
  | 'other';

export interface WorkingDay {
  id: string;
  academicPeriodId: string;
  dayOfWeek: WeekdayCode;
  sequenceNumber: number;
  isEnabled: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkingDayRow {
  id: string;
  academic_period_id: string;
  day_of_week: WeekdayCode;
  sequence_number: number;
  is_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  id: string;
  academicPeriodId: string;
  name: string;
  code: string;
  slotType: TimeSlotType;
  startsAt: string;
  endsAt: string;
  sequenceNumber: number;
  isEnabled: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlotRow {
  id: string;
  academic_period_id: string;
  name: string;
  code: string;
  slot_type: TimeSlotType;
  starts_at: string;
  ends_at: string;
  sequence_number: number;
  is_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkingDayActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    academicPeriodId?: string[];
    dayOfWeek?: string[];
    sequenceNumber?: string[];
    notes?: string[];
  };
}

export interface TimeSlotActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    academicPeriodId?: string[];
    name?: string[];
    code?: string[];
    slotType?: string[];
    startsAt?: string[];
    endsAt?: string[];
    sequenceNumber?: string[];
    notes?: string[];
  };
}

export const initialWorkingDayActionState:
WorkingDayActionState = {
  status: 'idle',
  message: null,
};

export const initialTimeSlotActionState:
TimeSlotActionState = {
  status: 'idle',
  message: null,
};

export const weekdayOptions: Array<{
  value: WeekdayCode;
  label: string;
  sequenceNumber: number;
}> = [
  {
    value: 'monday',
    label: 'Monday',
    sequenceNumber: 1,
  },
  {
    value: 'tuesday',
    label: 'Tuesday',
    sequenceNumber: 2,
  },
  {
    value: 'wednesday',
    label: 'Wednesday',
    sequenceNumber: 3,
  },
  {
    value: 'thursday',
    label: 'Thursday',
    sequenceNumber: 4,
  },
  {
    value: 'friday',
    label: 'Friday',
    sequenceNumber: 5,
  },
  {
    value: 'saturday',
    label: 'Saturday',
    sequenceNumber: 6,
  },
  {
    value: 'sunday',
    label: 'Sunday',
    sequenceNumber: 7,
  },
];

export const timeSlotTypeOptions: Array<{
  value: TimeSlotType;
  label: string;
}> = [
  {
    value: 'teaching',
    label: 'Teaching',
  },
  {
    value: 'break',
    label: 'Break',
  },
  {
    value: 'lunch',
    label: 'Lunch',
  },
  {
    value: 'assembly',
    label: 'Assembly',
  },
  {
    value: 'other',
    label: 'Other',
  },
];