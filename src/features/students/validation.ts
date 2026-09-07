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

export const updateAdmissionNumberSchema = z.object({
  studentId: z.string().uuid('A valid student identifier is required.'),
  admissionNumber: z
    .string()
    .trim()
    .min(3, 'Admission number must be at least 3 characters.')
    .max(80, 'Admission number cannot exceed 80 characters.')
    .transform((val) => val.toUpperCase().replace(/\s+/g, ' ')),
  reason: z.string().trim().max(500, 'Keep the reason below 500 characters.').optional(),
  notes: z.string().trim().max(2000, 'Keep notes below 2,000 characters.').optional(),
});

export const batchUpdateStudentStatusSchema = z
  .object({
    studentIds: z.array(z.string().uuid()).min(1, 'Select at least one student.'),
    status: z.enum(['active', 'deferred', 'dropped_out', 'withdrawn'], {
      message: 'Select a valid status.',
    }),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid effective date.'),
    reason: z.string().trim().max(500, 'Keep the reason below 500 characters.').optional(),
    expectedResumeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid return date.').optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'deferred' && !value.expectedResumeDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['expectedResumeDate'],
        message: 'Expected resumption date is required for deferral.',
      });
    }
    if (['deferred', 'dropped_out', 'withdrawn'].includes(value.status) && !value.reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A reason is required when deferring or marking dropped out.',
      });
    }
  });

export const batchReassignStudentCohortSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Select at least one student.'),
  targetCohortId: z.string().uuid('Select a target cohort.'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid effective date.'),
  reason: z.string().trim().max(500, 'Keep the reason below 500 characters.').optional(),
  notes: z.string().trim().max(2000, 'Keep notes below 2,000 characters.').optional(),
});


