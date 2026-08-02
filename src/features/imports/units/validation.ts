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

const optionalRoomTypeSchema =
  z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined
      ) {
        return undefined;
      }

      const normalized =
        String(value)
          .trim()
          .toLowerCase();

      return normalized || undefined;
    },
    z
      .enum([
        'lecture_room',
        'laboratory',
        'skills_room',
        'computer_lab',
        'kitchen',
        'conference_room',
        'other',
      ])
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

export const unitImportRowSchema = z
  .object({
    programmeCode: z.preprocess(
      (value) =>
        String(value ?? '')
          .trim()
          .toUpperCase(),
      z
        .string()
        .min(
          1,
          'Enter the programme code.',
        )
        .max(
          40,
          'The programme code cannot exceed 40 characters.',
        )
        .regex(
          /^[A-Z0-9/_-]+$/,
          'Use a valid programme code.',
        ),
    ),

    code: z.preprocess(
      (value) =>
        String(value ?? '')
          .trim()
          .toUpperCase(),
      z
        .string()
        .min(
          1,
          'Enter the unit code.',
        )
        .max(
          50,
          'The unit code cannot exceed 50 characters.',
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
        .min(
          2,
          'Enter the official unit name.',
        )
        .max(
          180,
          'The unit name cannot exceed 180 characters.',
        ),
    ),

    shortName: optionalText(
      80,
      'The short name cannot exceed 80 characters.',
    ),

    category: z.preprocess(
      (value) =>
        String(value ?? '')
          .trim()
          .toLowerCase(),
      z.enum([
        'core',
        'common',
        'elective',
        'practical',
        'clinical',
        'project',
        'other',
      ]),
    ),

    academicPeriodNumber: z.coerce
      .number()
      .int(
        'The Academic Period number must be a whole number.',
      )
      .min(
        1,
        'The Academic Period number must be at least one.',
      )
      .max(
        60,
        'The Academic Period number cannot exceed 60.',
      ),

    theoryHours: z.coerce
      .number()
      .min(
        0,
        'Theory hours cannot be negative.',
      )
      .max(
        100,
        'Theory hours cannot exceed 100.',
      ),

    practicalHours: z.coerce
      .number()
      .min(
        0,
        'Practical hours cannot be negative.',
      )
      .max(
        100,
        'Practical hours cannot exceed 100.',
      ),

    weeklySessions: z.coerce
      .number()
      .int(
        'Weekly sessions must be a whole number.',
      )
      .min(
        1,
        'At least one weekly session is required.',
      )
      .max(
        20,
        'Weekly sessions cannot exceed 20.',
      ),

    preferredRoomType:
      optionalRoomTypeSchema,

    timetableAvailable:
      timetableAvailabilitySchema,

    notes: optionalText(
      1500,
      'Notes cannot exceed 1,500 characters.',
    ),
  })
  .superRefine((value, context) => {
    if (
      value.theoryHours +
        value.practicalHours <=
      0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['theoryHours'],
        message:
          'The unit must contain theory or practical contact hours.',
      });

      context.addIssue({
        code: 'custom',
        path: ['practicalHours'],
        message:
          'The unit must contain theory or practical contact hours.',
      });
    }

    if (
      (
        value.category === 'practical' ||
        value.category === 'clinical'
      ) &&
      value.practicalHours <= 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['practicalHours'],
        message:
          'Practical or clinical units must contain practical hours.',
      });
    }
  });

export type UnitImportRowInput =
  z.infer<typeof unitImportRowSchema>;