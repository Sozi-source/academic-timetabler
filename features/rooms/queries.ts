import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  Room,
  RoomRow,
} from './types';

const roomSelection = `
  id,
  code,
  name,
  room_type,
  building,
  floor_label,
  capacity,
  is_accessible,
  is_active,
  is_timetable_available,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at
`;

function mapRoom(
  row: RoomRow,
): Room {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    roomType: row.room_type,
    building: row.building,
    floorLabel: row.floor_label,
    capacity: row.capacity,
    isAccessible: row.is_accessible,
    isActive: row.is_active,
    isTimetableAvailable:
      row.is_timetable_available,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getRooms = cache(
  async (): Promise<Room[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('rooms')
      .select(roomSelection)
      .order('is_active', {
        ascending: false,
      })
      .order('code', {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `Unable to load rooms: ${error.message}`,
      );
    }

    return (
      (data ?? []) as RoomRow[]
    ).map(mapRoom);
  },
);

export const getRoomById = cache(
  async (
    id: string,
  ): Promise<Room | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('rooms')
      .select(roomSelection)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load the room: ${error.message}`,
      );
    }

    return data
      ? mapRoom(data as RoomRow)
      : null;
  },
);

export const getTimetableAvailableRooms =
  cache(
    async (): Promise<Room[]> => {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('rooms')
        .select(roomSelection)
        .eq('is_active', true)
        .eq(
          'is_timetable_available',
          true,
        )
        .order('capacity', {
          ascending: true,
        })
        .order('code', {
          ascending: true,
        });

      if (error) {
        throw new Error(
          `Unable to load timetable rooms: ${error.message}`,
        );
      }

      return (
        (data ?? []) as RoomRow[]
      ).map(mapRoom);
    },
  );