import { z } from 'zod';

const unitCategorySchema = z.enum([
  'core',
  'common',
  'elective',
  'practical',
  'clinical',
  'project',
  'other',
]);

const preferredRoomTypeSchema = z.enum([
  'lecture_room',
  'laboratory',
  'skills_room',
  'computer_lab',
  'kitchen',
  'conference_room',
  'other',
]);

function optionalText(maxLength: number) {
  return z.preprocess(
    (value) => {
      const text = String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ');

      return text || undefined;
    },
    z.string().max(maxLength).optional(),
  );
}

function normaliseUnitCode(value: unknown) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

const timetableAvailabilitySchema = z.preprocess(
  (value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    const text = String(value ?? '')
      .trim()
      .toLowerCase();

    if (
      text === 'yes' ||
      text === 'true' ||
      text === '1'
    ) {
      return true;
    }

    if (
      text === 'no' ||
      text === 'false' ||
      text === '0'
    ) {
      return false;
    }

    return value;
  },
  z.boolean({
    error:
      'Timetable Available must be Yes or No.',
  }),
);

const optionalPreferredRoomTypeSchema =
  z.preprocess(
    (value) => {
      const text = String(value ?? '')
        .trim()
        .toLowerCase();

      return text || undefined;
    },
    preferredRoomTypeSchema.optional(),
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
          'Enter the Programme Code.',
        )
        .max(40),
    ),

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

    shortName: optionalText(80),

    category: z.preprocess(
      (value) =>
        String(value ?? '')
          .trim()
          .toLowerCase(),
      unitCategorySchema,
    ),

    academicPeriodNumber: z.coerce
      .number()
      .int(
        'Academic Period Number must be a whole number.',
      )
      .min(
        1,
        'Academic Period Number must be at least 1.',
      )
      .max(
        60,
        'Academic Period Number cannot exceed 60.',
      ),

    theoryHours: z.coerce
      .number()
      .min(
        0,
        'Theory Hours cannot be negative.',
      )
      .max(
        80,
        'Theory Hours cannot exceed 80.',
      ),

    practicalHours: z.coerce
      .number()
      .min(
        0,
        'Practical Hours cannot be negative.',
      )
      .max(
        80,
        'Practical Hours cannot exceed 80.',
      ),

    weeklySessions: z.coerce
      .number()
      .int(
        'Weekly Sessions must be a whole number.',
      )
      .min(
        1,
        'Weekly Sessions must be at least 1.',
      )
      .max(
        20,
        'Weekly Sessions cannot exceed 20.',
      ),

    timetableAvailable:
      timetableAvailabilitySchema,

    preferredRoomType:
      optionalPreferredRoomTypeSchema,

    notes: z.preprocess(
      (value) => {
        const text = String(value ?? '')
          .trim();

        return text || undefined;
      },
      z
        .string()
        .max(1500)
        .optional(),
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

export type UnitImportRowInput =
  z.infer<
    typeof unitImportRowSchema
  >;
