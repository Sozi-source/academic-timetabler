import { z } from 'zod';

export const studentProgressionSchema = z.object({
  studentId: z.string().uuid(),
  eventType: z.enum([
    'deferral',
    'resumption',
    'leave_started',
    'withdrawal',
    'discontinuation',
    'programme_completion',
    'graduation',
  ]),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid effective date.'),
  targetCohortId: z.string().uuid().optional(),
  expectedResumeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().trim().max(500, 'Keep the reason below 500 characters.').optional(),
  notes: z.string().trim().max(2000, 'Keep notes below 2,000 characters.').optional(),
}).superRefine((value, ctx) => {
  if (value.eventType === 'resumption' && !value.targetCohortId) {
    ctx.addIssue({ code: 'custom', path: ['targetCohortId'], message: 'Select the study cohort.' });
  }

  if (['deferral', 'leave_started'].includes(value.eventType) && !value.expectedResumeDate) {
    ctx.addIssue({ code: 'custom', path: ['expectedResumeDate'], message: 'Enter the expected return date.' });
  }

  if (['deferral', 'leave_started', 'withdrawal', 'discontinuation'].includes(value.eventType) && !value.reason) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Enter a brief reason.' });
  }
});
