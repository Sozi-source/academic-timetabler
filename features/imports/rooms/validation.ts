import { z } from 'zod';

const optionalText = (
  maximumLength: number,
  message: string,
) =>
  z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined
      ) {
        return undefined;
      }

      const normalized =
        String(value).trim();

      return normalized || undefined;
    },
    z
      .string()
      .max(maximumLength, message)
      .optional(),
  );

const timetableAvailabilitySchema =
  z.preprocess(
    (value) =>
      String(value ?? '')
        .trim()
        .toLowerCase(),
    z
      .enum(['yes', 'no'])
      .transform((value) => value === 'yes'),
  );

export const roomImportRowSchema = z.object({
  code: z.preprocess(
    (value) =>
      String(value ?? '')
        .trim()
        .toUpperCase(),
    z
      .string()
      .min(1, 'Enter the room code.')
      .max(
        40,
        'The room code cannot exceed 40 characters.',
      )
      .regex(
        /^[A-Z0-9/_-]+$/,
        'Use letters, numbers, slashes, underscores and hyphens only.',
      ),
  ),

  name: z.preprocess(
    (value) =>
      String(value ?? '').trim(),
    z
      .string()
      .min(2, 'Enter the room name.')
      .max(
        150,
        'The room name cannot exceed 150 characters.',
      ),
  ),

  roomType: z.preprocess(
    (value) =>
      String(value ?? '')
        .trim()
        .toLowerCase(),
    z.enum([
      'lecture_room',
      'laboratory',
      'skills_room',
      'computer_lab',
      'kitchen',
      'conference_room',
      'other',
    ]),
  ),

  capacity: z.coerce
    .number()
    .int(
      'Room capacity must be a whole number.',
    )
    .min(
      1,
      'Room capacity must be at least one.',
    )
    .max(
      5000,
      'Room capacity cannot exceed 5,000.',
    ),

  building: optionalText(
    150,
    'Building cannot exceed 150 characters.',
  ),

  floor: optionalText(
    100,
    'Floor cannot exceed 100 characters.',
  ),

  timetableAvailable:
    timetableAvailabilitySchema,

  notes: optionalText(
    1000,
    'Notes cannot exceed 1,000 characters.',
  ),
});

export type RoomImportRowInput =
  z.infer<typeof roomImportRowSchema>;