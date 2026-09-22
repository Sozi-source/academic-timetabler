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

export const batchUpdateStudentStatusSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Select at least one student.'),
  status: z.enum(['active', 'deferred', 'dropped_out', 'suspended', 'completed', 'graduated'], { message: 'Select a valid status.' }),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid effective date.'),
});

export const batchReassignStudentCohortSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Select at least one student.'),
  targetCohortId: z.string().uuid('Select a target cohort.'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid effective date.'),
  reason: z.string().trim().max(500, 'Keep the reason below 500 characters.').optional(),
  notes: z.string().trim().max(2000, 'Keep notes below 2,000 characters.').optional(),
});


