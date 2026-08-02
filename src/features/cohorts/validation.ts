import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export const cohortFormSchema = z
  .object({
    programmeId: z.uuid(
      'Select a valid programme.',
    ),

    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, 'Enter the cohort code.')
      .max(
        50,
        'The cohort code cannot exceed 50 characters.',
      )
      .regex(
        /^[A-Z0-9/_-]+$/,
        'Use letters, numbers, slashes, underscores and hyphens only.',
      ),

    name: z
      .string()
      .trim()
      .min(2, 'Enter the cohort name.')
      .max(
        150,
        'The cohort name cannot exceed 150 characters.',
      ),

    intakeDate: z
      .string()
      .refine(
        isValidDate,
        'Enter a valid intake date.',
      ),

    expectedCompletionDate: z
      .string()
      .refine(
        isValidDate,
        'Enter a valid expected completion date.',
      ),

    currentAcademicPeriodNumber: z.coerce
      .number()
      .int(
        'The current Academic Period must be a whole number.',
      )
      .min(
        1,
        'The current Academic Period must be at least 1.',
      )
      .max(
        60,
        'The current Academic Period cannot exceed 60.',
      ),

    plannedSize: z
      .union([
        z.coerce
          .number()
          .int(
            'Planned size must be a whole number.',
          )
          .min(
            1,
            'Planned size must be at least 1.',
          )
          .max(
            5000,
            'Planned size cannot exceed 5,000 learners.',
          ),
        z.literal(''),
        z.undefined(),
      ])
      .transform((value) =>
        value === '' || value === undefined
          ? undefined
          : value,
      ),

    actualSize: z.coerce
      .number()
      .int(
        'Actual size must be a whole number.',
      )
      .min(
        0,
        'Actual size cannot be negative.',
      )
      .max(
        5000,
        'Actual size cannot exceed 5,000 learners.',
      ),

    status: z.enum([
      'planned',
      'active',
      'completed',
      'suspended',
      'archived',
    ]),

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
      isValidDate(value.intakeDate) &&
      isValidDate(
        value.expectedCompletionDate,
      ) &&
      value.expectedCompletionDate <=
        value.intakeDate
    ) {
      context.addIssue({
        code: 'custom',
        path: ['expectedCompletionDate'],
        message:
          'The expected completion date must be after the intake date.',
      });
    }

    if (
      value.plannedSize !== undefined &&
      value.actualSize > value.plannedSize
    ) {
      context.addIssue({
        code: 'custom',
        path: ['actualSize'],
        message:
          'Actual size cannot exceed the planned size.',
      });
    }

    if (
      value.status === 'planned' &&
      value.actualSize > 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message:
          'A cohort with enrolled learners should be active rather than planned.',
      });
    }
  });

export const cohortIdSchema = z.uuid(
  'The cohort identifier is invalid.',
);

export const cohortStatusActionSchema =
  z.object({
    id: cohortIdSchema,
    status: z.enum([
      'planned',
      'active',
      'completed',
      'suspended',
      'archived',
    ]),
  });

export type CohortFormInput =
  z.infer<typeof cohortFormSchema>;