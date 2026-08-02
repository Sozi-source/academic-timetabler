import { z } from 'zod';

const optionalUuidSchema = z
  .union([
    z.uuid('Select a valid preferred room.'),
    z.literal(''),
    z.undefined(),
  ])
  .transform((value) =>
    value === '' || value === undefined
      ? undefined
      : value,
  );

export const teachingAllocationFormSchema = z
  .object({
    academicPeriodId: z.uuid(
      'Select a valid Academic Period.',
    ),

    cohortId: z.uuid(
      'Select a valid cohort.',
    ),

    unitId: z.uuid(
      'Select a valid unit.',
    ),

    trainerId: z.uuid(
      'Select a valid trainer.',
    ),

    preferredRoomId: optionalUuidSchema,

    deliveryMode: z.enum([
      'theory',
      'practical',
      'clinical',
      'blended',
      'project',
      'other',
    ]),

    weeklySessions: z.coerce
      .number()
      .int(
        'Weekly sessions must be a whole number.',
      )
      .min(
        1,
        'At least one weekly session is required.',
      )
      .max(
        20,
        'Weekly sessions cannot exceed 20.',
      ),

    sessionDurationMinutes: z.coerce
      .number()
      .int(
        'Session duration must be a whole number.',
      )
      .min(
        30,
        'A session must be at least 30 minutes.',
      )
      .max(
        480,
        'A session cannot exceed 480 minutes.',
      ),

    status: z.enum([
      'draft',
      'active',
      'suspended',
      'completed',
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
      value.sessionDurationMinutes % 15 !==
      0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['sessionDurationMinutes'],
        message:
          'Session duration must use 15-minute increments.',
      });
    }

    if (
      value.deliveryMode === 'clinical' &&
      value.sessionDurationMinutes < 60
    ) {
      context.addIssue({
        code: 'custom',
        path: ['sessionDurationMinutes'],
        message:
          'Clinical sessions must be at least 60 minutes.',
      });
    }

    if (
      value.deliveryMode === 'practical' &&
      value.sessionDurationMinutes < 60
    ) {
      context.addIssue({
        code: 'custom',
        path: ['sessionDurationMinutes'],
        message:
          'Practical sessions must be at least 60 minutes.',
      });
    }
  });

export const teachingAllocationIdSchema =
  z.uuid(
    'The teaching allocation identifier is invalid.',
  );

export const teachingAllocationStatusActionSchema =
  z.object({
    id: teachingAllocationIdSchema,
    status: z.enum([
      'draft',
      'active',
      'suspended',
      'completed',
      'archived',
    ]),
  });

export type TeachingAllocationFormInput =
  z.infer<
    typeof teachingAllocationFormSchema
  >;