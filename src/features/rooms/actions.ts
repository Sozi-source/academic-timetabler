'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  RoomActionState,
} from './types';
import {
  roomFormSchema,
  roomIdSchema,
} from './validation';

function revalidateRoomPages(
  id?: string,
) {
  revalidatePath('/dashboard');
  revalidatePath('/timetable/rooms');

  if (id) {
    revalidatePath(
      `/timetable/rooms/${id}/edit`,
    );
  }
}

function getRoomDatabaseErrorMessage(
  code?: string,
  message?: string,
) {
  if (
    message?.includes(
      'rooms_code_unique_idx',
    )
  ) {
    return 'A room with this code already exists.';
  }

  if (
    message?.includes(
      'rooms_name_building_unique_idx',
    )
  ) {
    return 'A room with this name already exists in the selected building.';
  }

  switch (code) {
    case '23505':
      return 'A room with the same code or name already exists.';

    case '23514':
      return 'The room does not satisfy the required validation rules.';

    case '42501':
      return 'You are not authorized to manage rooms.';

    case 'P0002':
      return 'The requested room was not found.';

    default:
      return 'The room could not be saved. Please try again.';
  }
}

function parseBoolean(
  formData: FormData,
  fieldName: string,
) {
  return (
    formData.get(fieldName) === 'on' ||
    formData.get(fieldName) === 'true'
  );
}

function parseRoomForm(
  formData: FormData,
) {
  return roomFormSchema.safeParse({
    code: formData.get('code'),
    name: formData.get('name'),
    roomType:
      formData.get('roomType'),
    building:
      formData.get('building') || undefined,
    floorLabel:
      formData.get('floorLabel') || undefined,
    capacity:
      formData.get('capacity'),
    isAccessible: parseBoolean(
      formData,
      'isAccessible',
    ),
    isTimetableAvailable: parseBoolean(
      formData,
      'isTimetableAvailable',
    ),
    notes:
      formData.get('notes') || undefined,
  });
}

export async function createRoomAction(
  _previousState: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  await requireHodAccess();

  const parsed =
    parseRoomForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('rooms')
    .insert({
      code: parsed.data.code,
      name: parsed.data.name,
      room_type:
        parsed.data.roomType,
      building:
        parsed.data.building || null,
      floor_label:
        parsed.data.floorLabel || null,
      capacity:
        parsed.data.capacity,
      is_accessible:
        parsed.data.isAccessible,
      is_timetable_available:
        parsed.data.isTimetableAvailable,
      is_active: true,
      notes:
        parsed.data.notes || null,
    });

  if (error) {
    return {
      status: 'error',
      message:
        getRoomDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateRoomPages();

  return {
    status: 'success',
    message:
      'Room created successfully.',
  };
}

export async function updateRoomAction(
  _previousState: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  await requireHodAccess();

  const idResult =
    roomIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    return {
      status: 'error',
      message:
        'The room identifier is invalid.',
    };
  }

  const parsed =
    parseRoomForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('rooms')
    .update({
      code: parsed.data.code,
      name: parsed.data.name,
      room_type:
        parsed.data.roomType,
      building:
        parsed.data.building || null,
      floor_label:
        parsed.data.floorLabel || null,
      capacity:
        parsed.data.capacity,
      is_accessible:
        parsed.data.isAccessible,
      is_timetable_available:
        parsed.data.isTimetableAvailable,
      notes:
        parsed.data.notes || null,
    })
    .eq('id', idResult.data);

  if (error) {
    return {
      status: 'error',
      message:
        getRoomDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateRoomPages(
    idResult.data,
  );

  return {
    status: 'success',
    message:
      'Room updated successfully.',
  };
}

export async function setRoomActiveAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    roomIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    throw new Error(
      'Invalid room identifier.',
    );
  }

  const isActive =
    formData.get('isActive') === 'true';

  const supabase = await createClient();

  const updateValues:
    Record<string, boolean> = {
      is_active: isActive,
    };

  if (!isActive) {
    updateValues.is_timetable_available =
      false;
  }

  const { error } = await supabase
    .from('rooms')
    .update(updateValues)
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getRoomDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateRoomPages(
    idResult.data,
  );
}

export async function setRoomTimetableAvailabilityAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    roomIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    throw new Error(
      'Invalid room identifier.',
    );
  }

  const isAvailable =
    formData.get('isTimetableAvailable') ===
    'true';

  const supabase = await createClient();

  if (isAvailable) {
    const {
      data: room,
      error: lookupError,
    } = await supabase
      .from('rooms')
      .select('is_active')
      .eq('id', idResult.data)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        getRoomDatabaseErrorMessage(
          lookupError.code,
          lookupError.message,
        ),
      );
    }

    if (!room) {
      throw new Error(
        'The requested room was not found.',
      );
    }

    if (!room.is_active) {
      throw new Error(
        'Activate the room before making it available for timetable scheduling.',
      );
    }
  }

  const { error } = await supabase
    .from('rooms')
    .update({
      is_timetable_available:
        isAvailable,
    })
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getRoomDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateRoomPages(
    idResult.data,
  );
}