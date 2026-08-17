import { z } from 'zod';

function normaliseUnitCode(value: unknown) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

const preferredRoomTypeSchema = z.enum([
  'lecture_room',
  'laboratory',
  'skills_room',
  'computer_lab',
  'kitchen',
  'conference_room',
  'other',
]);

export const unitFormSchema = z
  .object({
    programmeId: z
      .string()
      .uuid('Select a valid programme.'),

    code: z.preprocess(
      normaliseUnitCode,
      z
        .string()
        .min(
          1,
          'Enter the Unit Code.',
        )
        .max(
          60,
          'Unit Code must be 60 characters or fewer.',
        )
        .regex(
          /^[A-Z0-9][A-Z0-9 _/-]*$/,
          'Use letters, numbers, spaces, slashes, underscores and hyphens only.',
        ),
    ),

    name: z.preprocess(
      (value) =>
        String(value ?? '')
          .trim()
          .replace(/\s+/g, ' '),
      z
        .string()
        .min(
          2,
          'Enter the Unit Name.',
        )
        .max(180),
    ),

    shortName: z.preprocess(
      (value) => {
        const text = String(value ?? '')
          .trim()
          .replace(/\s+/g, ' ');
        return text || undefined;
      },
      z.string().max(80).optional(),
    ),

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
      .int()
      .min(1)
      .max(60),

    theoryHours: z.coerce
      .number()
      .min(0)
      .max(80),

    practicalHours: z.coerce
      .number()
      .min(0)
      .max(80),

    weeklySessions: z.coerce
      .number()
      .int()
      .min(1)
      .max(20),

    preferredRoomType: z.preprocess(
      (value) => {
        const text = String(value ?? '')
          .trim()
          .toLowerCase();
        return text || undefined;
      },
      preferredRoomTypeSchema.optional(),
    ),

    notes: z.preprocess(
      (value) => {
        const text = String(value ?? '')
          .trim();
        return text || undefined;
      },
      z.string().max(1500).optional(),
    ),
  })
  .superRefine((value, context) => {
    if (
      value.theoryHours === 0 &&
      value.practicalHours === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['theoryHours'],
        message:
          'A unit must have at least one contact hour per week.',
      });
    }

    if (
      value.category === 'practical' &&
      value.practicalHours <= 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['practicalHours'],
        message:
          'Practical units must have practical contact hours.',
      });
    }

    if (
      value.category === 'clinical' &&
      value.practicalHours <= 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['practicalHours'],
        message:
          'Clinical units must have practical or clinical contact hours.',
      });
    }
  });

export const unitIdSchema = z
  .string()
  .uuid('Invalid unit identifier.');

export type UnitFormInput =
  z.infer<typeof unitFormSchema>;
