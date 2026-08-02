import { z } from 'zod';

export const programmeFormSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Enter the programme code.')
    .max(
      40,
      'The programme code cannot exceed 40 characters.',
    )
    .regex(
      /^[A-Z0-9/_-]+$/,
      'Use letters, numbers, slashes, underscores and hyphens only.',
    ),

  name: z
    .string()
    .trim()
    .min(2, 'Enter the official programme name.')
    .max(
      180,
      'The programme name cannot exceed 180 characters.',
    ),

  shortName: z
    .string()
    .trim()
    .max(
      60,
      'The short name cannot exceed 60 characters.',
    )
    .optional(),

  awardLevel: z.enum([
    'certificate',
    'craft_certificate',
    'artisan_certificate',
    'diploma',
    'higher_diploma',
    'degree',
    'short_course',
    'other',
  ]),

  awardingBody: z
    .string()
    .trim()
    .max(
      150,
      'The awarding body cannot exceed 150 characters.',
    )
    .optional(),

  durationValue: z.coerce
    .number()
    .positive(
      'Programme duration must be greater than zero.',
    )
    .max(
      20,
      'Programme duration cannot exceed 20.',
    ),

  durationUnit: z.enum([
    'months',
    'years',
  ]),

  totalAcademicPeriods: z.coerce
    .number()
    .int(
      'Total Academic Periods must be a whole number.',
    )
    .min(
      1,
      'The programme must contain at least one Academic Period.',
    )
    .max(
      60,
      'Total Academic Periods cannot exceed 60.',
    ),

  maximumCohortSize: z
    .union([
      z.coerce
        .number()
        .int(
          'Maximum cohort size must be a whole number.',
        )
        .min(
          1,
          'Maximum cohort size must be at least 1.',
        )
        .max(
          5000,
          'Maximum cohort size cannot exceed 5,000.',
        ),
      z.literal(''),
      z.undefined(),
    ])
    .transform((value) =>
      value === '' || value === undefined
        ? undefined
        : value,
    ),

  notes: z
    .string()
    .trim()
    .max(
      1500,
      'Notes cannot exceed 1,500 characters.',
    )
    .optional(),
});

export const programmeIdSchema = z.uuid(
  'The programme identifier is invalid.',
);

export type ProgrammeFormInput =
  z.infer<typeof programmeFormSchema>;