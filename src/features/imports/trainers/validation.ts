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

    departmentCode: z.preprocess(
      (value) =>
        String(value ?? '')
          .trim()
          .toUpperCase(),
      z
        .string()
        .min(
          2,
          'Enter the trainer school / department code.',
        )
        .max(
          30,
          'The school / department code cannot exceed 30 characters.',
        )
        .regex(
          /^[A-Z0-9_-]+$/,
          'Use the exact registered school / department code.',
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

    workloadRole: z.preprocess(
      (value) => {
        const normalized =
          String(value ?? '')
            .trim()
            .toLowerCase();

        return normalized || undefined;
      },
      z
        .enum([
          'hod',
          'course_coordinator',
          'full_time_trainer',
          'part_time',
          'external',
        ])
        .optional(),
    ),

    specialization: optionalText(
      250,
      'Specialization cannot exceed 250 characters.',
    ),

    qualifications: optionalText(
      1000,
      'Qualifications cannot exceed 1,000 characters.',
    ),

    normalWeeklyHours: z.preprocess(
      (value) =>
        value === null || value === ''
          ? undefined
          : value,
      z.coerce
        .number()
        .positive(
          'Normal weekly hours must be greater than zero.',
        )
        .max(
          80,
          'Normal weekly hours cannot exceed 80.',
        )
        .optional(),
    ),

    maximumWeeklyHours: z.preprocess(
      (value) =>
        value === null || value === ''
          ? undefined
          : value,
      z.coerce
        .number()
        .positive(
          'Maximum weekly hours must be greater than zero.',
        )
        .max(
          80,
          'Maximum weekly hours cannot exceed 80.',
        )
        .optional(),
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

    availabilityMode: z.preprocess(
      (value) => {
        const normalized =
          String(value ?? '')
            .trim()
            .toLowerCase();

        return normalized || undefined;
      },
      z
        .enum([
          'generally_available',
          'selected_slots_only',
        ])
        .optional(),
    ),

    timetableAvailable:
      timetableAvailabilitySchema,

    notes: optionalText(
      1000,
      'Notes cannot exceed 1,000 characters.',
    ),
  })
  .transform((value) => {
    const workloadRole =
      value.workloadRole ??
      (value.employmentType === 'part_time'
        ? 'part_time'
        : value.employmentType === 'visiting' ||
            value.employmentType === 'contract'
          ? 'external'
          : 'full_time_trainer');

    const roleHours = {
      hod: {
        normal: 10,
      },
      course_coordinator: {
        normal: 16,
      },
      full_time_trainer: {
        normal: 20,
      },
      part_time: {
        normal: 12,
      },
      external: {
        normal: 12,
      },
    }[workloadRole];

    const normalWeeklyHours =
      ['hod', 'course_coordinator', 'full_time_trainer'].includes(workloadRole)
        ? roleHours.normal
        : value.normalWeeklyHours ?? roleHours.normal;

    return {
      ...value,
      workloadRole,
      normalWeeklyHours,
      maximumWeeklyHours: 80,
      availabilityMode:
        value.availabilityMode ??
        (workloadRole === 'part_time' ||
        workloadRole === 'external'
          ? 'selected_slots_only'
          : 'generally_available'),
    };
  });

export type TrainerImportRowInput =
  z.infer<typeof trainerImportRowSchema>;
