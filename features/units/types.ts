import type { RoomType } from '@/features/rooms/types';

export type UnitCategory =
  | 'core'
  | 'common'
  | 'elective'
  | 'practical'
  | 'clinical'
  | 'project'
  | 'other';

export interface UnitProgrammeSummary {
  id: string;
  code: string;
  name: string;
  totalAcademicPeriods: number;
  isActive: boolean;
  isTimetableAvailable: boolean;
}

export interface Unit {
  id: string;
  programmeId: string;
  code: string;
  name: string;
  shortName: string | null;
  category: UnitCategory;
  academicPeriodNumber: number;
  theoryHours: number;
  practicalHours: number;
  weeklySessions: number;
  preferredRoomType: RoomType | null;
  isActive: boolean;
  isTimetableAvailable: boolean;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  programme: UnitProgrammeSummary | null;
}

export interface UnitRow {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  short_name: string | null;
  category: UnitCategory;
  academic_period_number: number;
  theory_hours: number | string;
  practical_hours: number | string;
  weekly_sessions: number;
  preferred_room_type: RoomType | null;
  is_active: boolean;
  is_timetable_available: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  programmes:
    | {
        id: string;
        code: string;
        name: string;
        total_academic_periods: number;
        is_active: boolean;
        is_timetable_available: boolean;
      }
    | {
        id: string;
        code: string;
        name: string;
        total_academic_periods: number;
        is_active: boolean;
        is_timetable_available: boolean;
      }[]
    | null;
}

export interface UnitActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    programmeId?: string[];
    code?: string[];
    name?: string[];
    shortName?: string[];
    category?: string[];
    academicPeriodNumber?: string[];
    theoryHours?: string[];
    practicalHours?: string[];
    weeklySessions?: string[];
    preferredRoomType?: string[];
    notes?: string[];
  };
}

export const initialUnitActionState:
UnitActionState = {
  status: 'idle',
  message: null,
};

export const unitCategoryOptions: Array<{
  value: UnitCategory;
  label: string;
}> = [
  {
    value: 'core',
    label: 'Core',
  },
  {
    value: 'common',
    label: 'Common',
  },
  {
    value: 'elective',
    label: 'Elective',
  },
  {
    value: 'practical',
    label: 'Practical',
  },
  {
    value: 'clinical',
    label: 'Clinical',
  },
  {
    value: 'project',
    label: 'Project',
  },
  {
    value: 'other',
    label: 'Other',
  },
];