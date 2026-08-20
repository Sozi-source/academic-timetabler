import {
  z,
} from 'zod';

function normalizedRequiredText(
  label: string,
  maximumLength = 250,
) {
  return z.preprocess(
    (value) =>
      String(value ?? '').trim(),
    z
      .string()
      .min(
        1,
        `Enter the ${label}.`,
      )
      .max(
        maximumLength,
        `The ${label} cannot exceed ${maximumLength} characters.`,
      ),
  );
}

function optionalText(
  maximumLength: number,
  message: string,
) {
  return z.preprocess(
    (value) => {
      const normalized =
        String(value ?? '').trim();

      return normalized || undefined;
    },
    z
      .string()
      .max(
        maximumLength,
        message,
      )
      .optional(),
  );
}

const yesNoSchema =
  z.preprocess(
    (value) =>
      String(value ?? '')
        .trim()
        .toLowerCase(),
    z
      .enum([
        'yes',
        'no',
      ])
      .transform(
        (value) =>
          value === 'yes',
      ),
  );

const sharedClassKeySchema =
  z.preprocess(
    (value) => {
      const normalized =
        String(value ?? '')
          .trim()
          .toUpperCase()
          .replace(
            /[^A-Z0-9]+/g,
            '-',
          )
          .replace(
            /^-+|-+$/g,
            '',
          );

      return normalized || undefined;
    },
    z
      .string()
      .min(
        3,
        'The shared class key must contain at least 3 characters.',
      )
      .max(
        120,
        'The shared class key cannot exceed 120 characters.',
      )
      .regex(
        /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
        'Use letters, numbers and hyphens in the shared class key.',
      )
      .optional(),
  );

export const unitOfferingImportRowSchema =
  z
    .object({
      academicPeriod:
        normalizedRequiredText(
          'Academic Period name or code',
          160,
        ),

      programmeName:
        normalizedRequiredText(
          'programme name',
          250,
        ),

      cohortName:
        normalizedRequiredText(
          'cohort name',
          250,
        ),

      unitName:
        normalizedRequiredText(
          'unit name',
          250,
        ),

      unitCode:
        optionalText(
          100,
          'The unit code cannot exceed 100 characters.',
        ),

      offeringType:
        z.preprocess(
          (value) =>
            String(value ?? '')
              .trim()
              .toLowerCase()
              .replace(
                /[\s-]+/g,
                '_',
              ),
          z.enum([
            'classroom',
            'practical',
            'clinical_rotation',
            'attachment',
            'project',
            'examination',
            'other',
          ]),
        ),

      weeklySessions:
        z.coerce
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

      sessionDurationMinutes:
        z.coerce
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

      timetableEnabled:
        yesNoSchema,

      status:
        z.preprocess(
          (value) =>
            String(value ?? '')
              .trim()
              .toLowerCase(),
          z.enum([
            'draft',
            'active',
            'completed',
            'cancelled',
          ]),
        ),

      sharedClassKey:
        sharedClassKeySchema,

      preferredTrainer:
        optionalText(
          250,
          'The preferred trainer cannot exceed 250 characters.',
        ),

      preferredRoom:
        optionalText(
          250,
          'The preferred room cannot exceed 250 characters.',
        ),

      notes:
        optionalText(
          1500,
          'Notes cannot exceed 1,500 characters.',
        ),
    })
    .superRefine(
      (
        value,
        context,
      ) => {
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
          value.offeringType ===
            'practical' &&
          value.sessionDurationMinutes <
            60
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'sessionDurationMinutes',
            ],
            message:
              'Practical sessions must be at least 60 minutes.',
          });
        }

        if (
          [
            'attachment',
            'clinical_rotation',
            'examination',
          ].includes(
            value.offeringType,
          ) &&
          value.timetableEnabled
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'timetableEnabled',
            ],
            message:
              'Attachment, clinical rotation and examination units cannot enter the ordinary classroom timetable.',
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
            path: ['status'],
            message:
              'Only draft or active units can be timetable-enabled.',
          });
        }

        if (
          value.sharedClassKey &&
          !value.timetableEnabled
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'sharedClassKey',
            ],
            message:
              'A shared class key may only be used for a timetable-enabled unit.',
          });
        }
      },
    );

export type UnitOfferingImportRowInput =
  z.infer<
    typeof unitOfferingImportRowSchema
  >;