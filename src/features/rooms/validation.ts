import { z } from 'zod';

export const roomFormSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Enter a room code.')
    .max(
      30,
      'The room code cannot exceed 30 characters.',
    )
    .regex(
      /^[A-Z0-9-]+$/,
      'Use letters, numbers and hyphens only.',
    ),

  name: z
    .string()
    .trim()
    .min(2, 'Enter the official room name.')
    .max(
      100,
      'The room name cannot exceed 100 characters.',
    ),

  roomType: z.enum([
    'lecture_room',
    'laboratory',
    'skills_room',
    'computer_lab',
    'kitchen',
    'conference_room',
    'other',
  ]),

  building: z
    .string()
    .trim()
    .max(
      100,
      'The building name cannot exceed 100 characters.',
    )
    .optional(),

  floorLabel: z
    .string()
    .trim()
    .max(
      50,
      'The floor label cannot exceed 50 characters.',
    )
    .optional(),

  capacity: z.coerce
    .number()
    .int('Capacity must be a whole number.')
    .min(1, 'Capacity must be at least 1.')
    .max(
      1000,
      'Capacity cannot exceed 1,000 learners.',
    ),

  isAccessible: z.boolean(),

  isTimetableAvailable: z.boolean(),

  notes: z
    .string()
    .trim()
    .max(
      1000,
      'Notes cannot exceed 1,000 characters.',
    )
    .optional(),
});

export const roomIdSchema = z.uuid(
  'The room identifier is invalid.',
);

export type RoomFormInput =
  z.infer<typeof roomFormSchema>;