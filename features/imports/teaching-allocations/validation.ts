import { z } from 'zod';

const requiredCode = (
  label: string,
  maximumLength = 80,
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

const optionalCode = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined
    ) {
      return undefined;
    }

    const normalized =
      String(value)
        .trim()
        .toUpperCase();

    return normalized || undefined;
  },
  z
    .string()
    .max(
      80,
      'The preferred room code cannot exceed 80 characters.',
    )
    .regex(
      /^[A-Z0-9/_-]+$/,
      'Enter a valid preferred room code.',
    )
    .optional(),
);

const timetableEnabledSchema =
  z.preprocess(
    (value) =>
      String(value ?? '')
        .trim()
        .toLowerCase(),
    z
      .enum(['yes', 'no'])
      .transform((value) => value === 'yes'),
  );

export const teachingAllocationImportRowSchema =
  z
    .object({
      academicPeriodCode:
        requiredCode(
          'Academic Period code',
        ),

      cohortCode:
        requiredCode('cohort code'),

      unitCode:
        requiredCode('unit code'),

      trainerStaffNumber:
        requiredCode(
          'trainer staff number',
        ),

      preferredRoomCode:
        optionalCode,

      deliveryMode: z.preprocess(
        (value) =>
          String(value ?? '')
            .trim()
            .toLowerCase(),
        z.enum([
          'theory',
          'practical',
          'clinical',
          'blended',
          'project',
          'other',
        ]),
      ),

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
          'Session duration must be at least 30 minutes.',
        )
        .max(
          480,
          'Session duration cannot exceed 480 minutes.',
        ),

      status: z.preprocess(
        (value) =>
          String(value ?? '')
            .trim()
            .toLowerCase(),
        z.enum([
          'draft',
          'active',
          'suspended',
          'completed',
          'archived',
        ]),
      ),

      timetableEnabled:
        timetableEnabledSchema,

      notes: z.preprocess(
        (value) => {
          const normalized =
            String(value ?? '').trim();

          return normalized || undefined;
        },
        z
          .string()
          .max(
            1500,
            'Notes cannot exceed 1,500 characters.',
          )
          .optional(),
      ),
    })
    .superRefine((value, context) => {
      if (
        value.sessionDurationMinutes %
          15 !==
        0
      ) {
        context.addIssue({
          code: 'custom',
          path: [
            'sessionDurationMinutes',
          ],
          message:
            'Session duration must use 15-minute increments.',
        });
      }

      if (
        (
          value.deliveryMode ===
            'practical' ||
          value.deliveryMode ===
            'clinical'
        ) &&
        value.sessionDurationMinutes < 60
      ) {
        context.addIssue({
          code: 'custom',
          path: [
            'sessionDurationMinutes',
          ],
          message:
            'Practical and clinical sessions must be at least 60 minutes.',
        });
      }

      if (
        value.timetableEnabled &&
        ![
          'draft',
          'active',
        ].includes(value.status)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['timetableEnabled'],
          message:
            'Only draft or active allocations can be timetable-enabled.',
        });
      }
    });

export type TeachingAllocationImportRowInput =
  z.infer<
    typeof teachingAllocationImportRowSchema
  >;