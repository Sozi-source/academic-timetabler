export type RoomType =
  | 'lecture_room'
  | 'laboratory'
  | 'skills_room'
  | 'computer_lab'
  | 'kitchen'
  | 'conference_room'
  | 'other';

export interface Room {
  id: string;
  code: string;
  name: string;
  roomType: RoomType;
  building: string | null;
  floorLabel: string | null;
  capacity: number;
  isAccessible: boolean;
  isActive: boolean;
  isTimetableAvailable: boolean;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  room_type: RoomType;
  building: string | null;
  floor_label: string | null;
  capacity: number;
  is_accessible: boolean;
  is_active: boolean;
  is_timetable_available: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    code?: string[];
    name?: string[];
    roomType?: string[];
    building?: string[];
    floorLabel?: string[];
    capacity?: string[];
    notes?: string[];
  };
}

export const initialRoomActionState:
RoomActionState = {
  status: 'idle',
  message: null,
};

export const roomTypeOptions: Array<{
  value: RoomType;
  label: string;
}> = [
  {
    value: 'lecture_room',
    label: 'Lecture room',
  },
  {
    value: 'laboratory',
    label: 'Laboratory',
  },
  {
    value: 'skills_room',
    label: 'Skills room',
  },
  {
    value: 'computer_lab',
    label: 'Computer laboratory',
  },
  {
    value: 'kitchen',
    label: 'Training kitchen',
  },
  {
    value: 'conference_room',
    label: 'Conference room',
  },
  {
    value: 'other',
    label: 'Other',
  },
];