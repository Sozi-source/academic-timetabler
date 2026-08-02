import { z } from 'zod';

const optionalEmailSchema = z
  .string()
  .trim()
  .max(
    254,
    'The email address cannot exceed 254 characters.',
  )
  .refine(
    (value) =>
      value.length === 0 ||
      z.email().safeParse(value).success,
    'Enter a valid email address.',
  )
  .optional();

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(
    30,
    'The phone number cannot exceed 30 characters.',
  )
  .refine(
    (value) =>
      value.length === 0 ||
      /^[+0-9][0-9\s()-]{6,29}$/.test(value),
    'Enter a valid phone number.',
  )
  .optional();

export const trainerFormSchema = z
  .object({
    staffNumber: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, 'Enter the trainer staff number.')
      .max(
        40,
        'The staff number cannot exceed 40 characters.',
      )
      .regex(
        /^[A-Z0-9/_-]+$/,
        'Use letters, numbers, slashes, underscores and hyphens only.',
      ),

    fullName: z
      .string()
      .trim()
      .min(2, 'Enter the trainer full name.')
      .max(
        150,
        'The full name cannot exceed 150 characters.',
      ),

    email: optionalEmailSchema,

    phoneNumber: optionalPhoneSchema,

    employmentType: z.enum([
      'full_time',
      'part_time',
      'visiting',
      'contract',
      'other',
    ]),

    specialization: z
      .string()
      .trim()
      .max(
        250,
        'Specialization cannot exceed 250 characters.',
      )
      .optional(),

    qualifications: z
      .string()
      .trim()
      .max(
        1000,
        'Qualifications cannot exceed 1,000 characters.',
      )
      .optional(),

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

export const trainerIdSchema = z.uuid(
  'The trainer identifier is invalid.',
);

export type TrainerFormInput =
  z.infer<typeof trainerFormSchema>;