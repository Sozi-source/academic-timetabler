import { z } from 'zod';

const optionalUuid = z.preprocess((value) => value === '' ? undefined : value, z.string().uuid().optional());
const optionalTime = z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^\d{2}:\d{2}$/).optional());

export const schedulingConstraintSchema = z.object({
  academicPeriodId: z.string().uuid(),
  subjectType: z.enum(['trainer','room','cohort','institution']),
  subjectId: optionalUuid,
  constraintType: z.enum(['unavailable','preferred','required','protected_day']),
  workingDayId: optionalUuid,
  startsAt: optionalTime,
  endsAt: optionalTime,
  priority: z.enum(['hard','soft']),
  reason: z.string().trim().min(3).max(500),
}).superRefine((value, context) => {
  if (value.subjectType !== 'institution' && !value.subjectId) context.addIssue({ code: 'custom', path: ['subjectId'], message: 'Select the affected record.' });
  if ((value.startsAt && !value.endsAt) || (!value.startsAt && value.endsAt)) context.addIssue({ code: 'custom', path: ['startsAt'], message: 'Provide both start and end times.' });
  if (value.startsAt && value.endsAt && value.startsAt >= value.endsAt) context.addIssue({ code: 'custom', path: ['endsAt'], message: 'End time must be later than start time.' });
});

export const constraintIdSchema = z.string().uuid();
