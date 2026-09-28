import { z } from 'zod';

const optionalUuid = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().uuid().optional(),
);

export const schedulingConstraintSchema = z.object({
  academicPeriodId: z.string().uuid(),
  subjectType: z.enum(['room', 'cohort', 'institution']),
  subjectId: optionalUuid,
  constraintType: z.literal('unavailable'),
  workingDayId: optionalUuid,
  timeSlotId: optionalUuid,
  priority: z.literal('hard'),
  reason: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.subjectType !== 'institution' && !value.subjectId) {
    context.addIssue({
      code: 'custom',
      path: ['subjectId'],
      message: 'Select the affected record.',
    });
  }
});

export const constraintIdSchema = z.string().uuid();
