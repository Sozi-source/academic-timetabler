import { z } from 'zod';

const optionalText = (
  maximumLength: number,
  message: string,
) =>
  z.preprocess(
    (value) => {
      const normalized =
        String(value ?? '').trim();

      return normalized || undefined;
    },
    z.string().max(maximumLength, message).optional(),
  );

const yesNoSchema = z.preprocess(
  (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase(),
  z.enum(['yes', 'no']).transform(
    (value) => value === 'yes',
  ),
);

const codeSchema = (
  label: string,
  maximumLength: number,
) =>
  z.preprocess(
    (value) =>
      String(value ?? '')
        .trim()
        .toUpperCase(),
    z
      .string()
      .min(1, `Enter the ${label}.`)
      .max(
        maximumLength,
        `The ${label} cannot exceed ${maximumLength} characters.`,
      )
      .regex(
        /^[A-Z0-9/_-]+$/,
        `Enter a valid ${label}.`,
      ),
  );

export const programmeImportRowSchema =
  z.object({
    code: codeSchema('programme code', 40),
    name: z.preprocess(
      (value) => String(value ?? '').trim(),
      z.string().min(2, 'Enter the programme name.').max(180),
    ),
    shortName: optionalText(
      60,
      'Short name cannot exceed 60 characters.',
    ),
    awardLevel: z.preprocess(
      (value) => String(value ?? '').trim().toLowerCase(),
      z.enum([
        'certificate',
        'craft_certificate',
        'artisan_certificate',
        'diploma',
        'higher_diploma',
        'degree',
        'short_course',
        'other',
      ]),
    ),
    awardingBody: optionalText(
      150,
      'Awarding body cannot exceed 150 characters.',
    ),
    durationValue: z.coerce.number().positive().max(20),
    durationUnit: z.preprocess(
      (value) => String(value ?? '').trim().toLowerCase(),
      z.enum(['months', 'years']),
    ),
    totalAcademicPeriods: z.coerce.number().int().min(1).max(60),
    maximumCohortSize: z.preprocess(
      (value) =>
        value === null || value === ''
          ? undefined
          : value,
      z.coerce.number().int().min(1).max(5000).optional(),
    ),
    timetableAvailable: yesNoSchema,
    notes: optionalText(
      1500,
      'Notes cannot exceed 1,500 characters.',
    ),
  });

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  const date =
    new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function generatedCohortCode(
  programmeCode: string,
  intakeDate: string,
) {
  const date =
    new Date(`${intakeDate}T00:00:00.000Z`);

  const month = date
    .toLocaleString('en', {
      month: 'short',
      timeZone: 'UTC',
    })
    .toUpperCase();

  return `${programmeCode}-${month}-${date.getUTCFullYear()}`;
}

export const cohortImportRowSchema = z
  .object({
    programmeCode: codeSchema(
      'programme code',
      40,
    ),
    code: z.preprocess(
      (value) => {
        const normalized =
          String(value ?? '')
            .trim()
            .toUpperCase();

        return normalized || undefined;
      },
      z
        .string()
        .max(50)
        .regex(/^[A-Z0-9/_-]+$/)
        .optional(),
    ),
    name: z.preprocess(
      (value) => String(value ?? '').trim(),
      z.string().min(2, 'Enter the cohort name.').max(150),
    ),
    intakeDate: z.preprocess(
      (value) => String(value ?? '').trim(),
      z.string().refine(
        isValidDate,
        'Enter a valid intake date in YYYY-MM-DD format.',
      ),
    ),
    actualSize: z.coerce.number().int().min(0).max(5000),
    status: z.preprocess(
      (value) => String(value ?? '').trim().toLowerCase(),
      z.enum([
        'planned',
        'active',
        'completed',
        'suspended',
        'archived',
      ]),
    ),
    notes: optionalText(
      1500,
      'Notes cannot exceed 1,500 characters.',
    ),
  })
  .superRefine((value, context) => {
    if (
      value.status === 'planned' &&
      value.actualSize > 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message:
          'Use active status when learners are enrolled.',
      });
    }
  })
  .transform((value) => ({
    ...value,
    code:
      value.code ??
      generatedCohortCode(
        value.programmeCode,
        value.intakeDate,
      ),
  }));
