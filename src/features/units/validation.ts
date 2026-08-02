import { z } from 'zod';

export const unitFormSchema = z
  .object({
    programmeId: z.uuid(
      'Select a valid programme.',
    ),

    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, 'Enter the unit code.')
      .max(
        50,
        'The unit code cannot exceed 50 characters.',
      )
      .regex(
        /^[A-Z0-9/_-]+$/,
        'Use letters, numbers, slashes, underscores and hyphens only.',
      ),

    name: z
      .string()
      .trim()
      .min(2, 'Enter the official unit name.')
      .max(
        180,
        'The unit name cannot exceed 180 characters.',
      ),

    shortName: z
      .string()
      .trim()
      .max(
        80,
        'The short name cannot exceed 80 characters.',
      )
      .optional(),

    category: z.enum([
      'core',
      'common',
      'elective',
      'practical',
      'clinical',
      'project',
      'other',
    ]),

    academicPeriodNumber: z.coerce
      .number()
      .int(
        'The Academic Period number must be a whole number.',
      )
      .min(
        1,
        'The Academic Period number must be at least 1.',
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

    preferredRoomType: z
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

    notes: z
      .string()
      .trim()
      .max(
        1500,
        'Notes cannot exceed 1,500 characters.',
      )
      .optional(),
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
          'Practical or clinical units must include practical contact hours.',
      });
    }
  });

export const unitIdSchema = z.uuid(
  'The unit identifier is invalid.',
);

export type UnitFormInput =
  z.infer<typeof unitFormSchema>;