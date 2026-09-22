import { z } from 'zod';

export const studentProgressionSchema = z.object({
  studentId: z.string().uuid(),
  eventType: z.enum([
    'status_update',
  ]),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid effective date.'),
  targetStatus: z.enum(['active', 'deferred', 'dropped_out', 'suspended', 'completed', 'graduated']),
  academicPlacement: z.enum(['in_class', 'attachment']),
  reportingStatus: z.enum(['reported', 'not_reported']),
});

// Batch status update schema with conditional requirements
export const batchUpdateStudentStatusSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Select at least one student.'),
  status: z.enum(['active', 'deferred', 'dropped_out', 'suspended', 'completed', 'graduated'], { message: 'Select a valid status.' }),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid effective date.'),
  // optional fields – will be required conditionally via superRefine below
  expectedResumeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid expected resume date.').optional(),
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters.').optional(),
}).superRefine((data, ctx) => {
  if (data.status === 'deferred') {
    if (!data.expectedResumeDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expectedResumeDate'],
        message: 'Expected resume date is required for deferred status.',
      });
    }
    if (!data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Reason is required for deferred status.',
      });
    }
  }
  if (data.status === 'dropped_out') {
    if (!data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Reason is required for dropped_out status.',
      });
    }
  }
});

export const batchReassignStudentCohortSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Select at least one student.'),
  targetCohortId: z.string().uuid('Select a target cohort.'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid effective date.'),
  reason: z.string().trim().max(500, 'Keep the reason below 500 characters.').optional(),
  notes: z.string().trim().max(2000, 'Keep notes below 2,000 characters.').optional(),
});

export const updateAdmissionNumberSchema = z.object({
  studentId: z.string().uuid('Enter a valid student identifier.'),
  admissionNumber: z.string()
    .min(3, 'Admission number must be at least 3 characters.')
    .max(80, 'Admission number cannot exceed 80 characters.')
    .transform((val) =>
      val.trim().replace(/\s+/g, ' ').toUpperCase(),
    ),
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters.').optional(),
  notes: z.string().trim().max(2000, 'Notes cannot exceed 2,000 characters.').optional(),
});
