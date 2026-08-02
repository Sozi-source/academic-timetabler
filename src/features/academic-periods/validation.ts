import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00.000Z`,
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export const academicPeriodFormSchema = z
  .object({
    academicYearId: z.uuid(
      'Select a valid Academic Year.',
    ),

    name: z
      .string()
      .trim()
      .min(2, 'Enter an Academic Period name.')
      .max(
        100,
        'The name cannot exceed 100 characters.',
      ),

    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, 'Enter a period code.')
      .max(
        30,
        'The code cannot exceed 30 characters.',
      )
      .regex(
        /^[A-Z0-9-]+$/,
        'Use letters, numbers and hyphens only.',
      ),

    sequenceNumber: z.coerce
      .number()
      .int('The sequence must be a whole number.')
      .min(1, 'The sequence must be at least 1.')
      .max(20, 'The sequence cannot exceed 20.'),

    startsOn: z
      .string()
      .refine(
        isValidDate,
        'Enter a valid period start date.',
      ),

    endsOn: z
      .string()
      .refine(
        isValidDate,
        'Enter a valid period end date.',
      ),

    teachingStartsOn: z
      .string()
      .refine(
        isValidDate,
        'Enter a valid teaching start date.',
      ),

    teachingEndsOn: z
      .string()
      .refine(
        isValidDate,
        'Enter a valid teaching end date.',
      ),

    notes: z
      .string()
      .trim()
      .max(
        1000,
        'Notes cannot exceed 1,000 characters.',
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      isValidDate(value.startsOn) &&
      isValidDate(value.endsOn) &&
      value.endsOn <= value.startsOn
    ) {
      context.addIssue({
        code: 'custom',
        path: ['endsOn'],
        message:
          'The period end date must be after its start date.',
      });
    }

    if (
      isValidDate(value.teachingStartsOn) &&
      isValidDate(value.teachingEndsOn) &&
      value.teachingEndsOn <
        value.teachingStartsOn
    ) {
      context.addIssue({
        code: 'custom',
        path: ['teachingEndsOn'],
        message:
          'Teaching must end on or after its start date.',
      });
    }

    if (
      isValidDate(value.startsOn) &&
      isValidDate(value.teachingStartsOn) &&
      value.teachingStartsOn < value.startsOn
    ) {
      context.addIssue({
        code: 'custom',
        path: ['teachingStartsOn'],
        message:
          'Teaching cannot begin before the Academic Period.',
      });
    }

    if (
      isValidDate(value.endsOn) &&
      isValidDate(value.teachingEndsOn) &&
      value.teachingEndsOn > value.endsOn
    ) {
      context.addIssue({
        code: 'custom',
        path: ['teachingEndsOn'],
        message:
          'Teaching cannot end after the Academic Period.',
      });
    }
  });

export const academicPeriodIdSchema = z.uuid(
  'The Academic Period identifier is invalid.',
);

export const academicPeriodStatusSchema = z.enum([
  'planned',
  'active',
  'closed',
  'archived',
]);