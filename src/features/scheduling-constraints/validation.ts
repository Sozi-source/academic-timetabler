import { z } from 'zod';

const optionalUuid = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().uuid().optional(),
);

export const schedulingConstraintSchema = z.object({
  academicPeriodId: z.string().uuid(),
  subjectType: z.enum(['trainer', 'room', 'cohort', 'institution']),
  subjectId: optionalUuid,
  constraintType: z.enum(['unavailable', 'preferred', 'required', 'protected_day']),
  workingDayId: optionalUuid,
  timeSlotId: optionalUuid,
  priority: z.enum(['hard', 'soft']),
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

export const timetableCalendarEventSchema = z.object({
  academicPeriodId: z.string().uuid(),
  title: z.string().trim().min(2, 'Enter an event title.').max(160),
  eventType: z.enum(['holiday', 'cat_exam', 'seminar', 'field_trip', 'custom']),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.'),
  timeSlotId: optionalUuid,
  scopeType: z.enum(['institution', 'cohort', 'trainer', 'room']),
  scopeId: optionalUuid,
  suspendsRegularClasses: z.boolean(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.scopeType !== 'institution' && !value.scopeId) {
    context.addIssue({
      code: 'custom',
      path: ['scopeId'],
      message: 'Select the affected trainer, room, or cohort.',
    });
  }
});

export const constraintIdSchema = z.string().uuid();
