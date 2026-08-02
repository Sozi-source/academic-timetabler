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

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined
    ) {
      return undefined;
    }

    const normalized =
      String(value).trim().toLowerCase();

    return normalized || undefined;
  },
  z
    .email('Enter a valid email address.')
    .max(
      254,
      'The email address cannot exceed 254 characters.',
    )
    .optional(),
);

const optionalPhoneSchema = z.preprocess(
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
    .max(
      30,
      'The phone number cannot exceed 30 characters.',
    )
    .regex(
      /^[+0-9][0-9\s()-]{6,29}$/,
      'Enter a valid phone number.',
    )
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

export const trainerImportRowSchema = z
  .object({
    staffNumber: z.preprocess(
      (value) =>
        String(value ?? '')
          .trim()
          .toUpperCase(),
      z
        .string()
        .min(
          1,
          'Enter the trainer staff number.',
        )
        .max(
          40,
          'The staff number cannot exceed 40 characters.',
        )
        .regex(
          /^[A-Z0-9/_-]+$/,
          'Use letters, numbers, slashes, underscores and hyphens only.',
        ),
    ),

    fullName: z.preprocess(
      (value) =>
        String(value ?? '').trim(),
      z
        .string()
        .min(
          2,
          'Enter the trainer full name.',
        )
        .max(
          150,
          'The full name cannot exceed 150 characters.',
        ),
    ),

    email: optionalEmailSchema,

    phoneNumber: optionalPhoneSchema,

    employmentType: z.preprocess(
      (value) =>
        String(value ?? '')
          .trim()
          .toLowerCase(),
      z.enum([
        'full_time',
        'part_time',
        'visiting',
        'contract',
        'other',
      ]),
    ),

    specialization: optionalText(
      250,
      'Specialization cannot exceed 250 characters.',
    ),

    qualifications: optionalText(
      1000,
      'Qualifications cannot exceed 1,000 characters.',
    ),

    maximumWeeklyHours: z.coerce
      .number()
      .positive(
        'Maximum weekly hours must be greater than zero.',
      )
      .max(
        80,
        'Maximum weekly hours cannot exceed 80.',
      ),

    maximumDailyHours: z.coerce
      .number()
      .positive(
        'Maximum daily hours must be greater than zero.',
      )
      .max(
        16,
        'Maximum daily hours cannot exceed 16.',
      ),

    timetableAvailable:
      timetableAvailabilitySchema,

    notes: optionalText(
      1000,
      'Notes cannot exceed 1,000 characters.',
    ),
  })
  .superRefine((value, context) => {
    if (
      value.maximumDailyHours >
      value.maximumWeeklyHours
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maximumDailyHours'],
        message:
          'Maximum daily hours cannot exceed maximum weekly hours.',
      });
    }
  });

export type TrainerImportRowInput =
  z.infer<typeof trainerImportRowSchema>;