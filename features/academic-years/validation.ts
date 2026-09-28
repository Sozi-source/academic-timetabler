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

export const academicYearFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Enter an academic year name.')
      .max(80, 'The name cannot exceed 80 characters.'),

    startsOn: z
      .string()
      .refine(
        isValidDate,
        'Enter a valid start date.',
      ),

    endsOn: z
      .string()
      .refine(
        isValidDate,
        'Enter a valid end date.',
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
          'The end date must be after the start date.',
      });
    }
  });

export const academicYearIdSchema = z.uuid(
  'The Academic Year identifier is invalid.',
);

export const academicYearStatusSchema = z.enum([
  'planned',
  'active',
  'closed',
  'archived',
]);

export type AcademicYearFormInput =
  z.infer<typeof academicYearFormSchema>;