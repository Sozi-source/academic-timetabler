import { describe, expect, it } from 'vitest';
import {
  batchReassignStudentCohortSchema,
  batchUpdateStudentStatusSchema,
} from '@/features/students/validation';

describe('Batch Student Lifecycle Validation Schemas', () => {
  const validUuid1 = '11111111-1111-4111-8111-111111111111';
  const validUuid2 = '22222222-2222-4222-8222-222222222222';
  const validCohortId = '33333333-3333-4333-8333-333333333333';

  describe('batchUpdateStudentStatusSchema', () => {
    it('accepts valid active status without mandatory reason', () => {
      const result = batchUpdateStudentStatusSchema.safeParse({
        studentIds: [validUuid1, validUuid2],
        status: 'active',
        effectiveDate: '2026-09-07',
        reason: 'Physical reporting confirmed',
      });

      expect(result.success).toBe(true);
    });

    it('rejects deferred status if expectedResumeDate is missing', () => {
      const result = batchUpdateStudentStatusSchema.safeParse({
        studentIds: [validUuid1],
        status: 'deferred',
        effectiveDate: '2026-09-07',
        reason: 'Financial constraints',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.expectedResumeDate).toBeDefined();
      }
    });

    it('rejects deferred status if reason is missing', () => {
      const result = batchUpdateStudentStatusSchema.safeParse({
        studentIds: [validUuid1],
        status: 'deferred',
        effectiveDate: '2026-09-07',
        expectedResumeDate: '2027-01-10',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.reason).toBeDefined();
      }
    });

    it('accepts valid deferral with resume date and reason', () => {
      const result = batchUpdateStudentStatusSchema.safeParse({
        studentIds: [validUuid1],
        status: 'deferred',
        effectiveDate: '2026-09-07',
        expectedResumeDate: '2027-01-10',
        reason: 'Personal compassionate leave',
      });

      expect(result.success).toBe(true);
    });

    it('rejects dropped_out if reason is missing', () => {
      const result = batchUpdateStudentStatusSchema.safeParse({
        studentIds: [validUuid1],
        status: 'dropped_out',
        effectiveDate: '2026-09-07',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.reason).toBeDefined();
      }
    });

    it('accepts valid dropped_out with reason', () => {
      const result = batchUpdateStudentStatusSchema.safeParse({
        studentIds: [validUuid1, validUuid2],
        status: 'dropped_out',
        effectiveDate: '2026-09-07',
        reason: 'Historical non-reporting prior to system adoption',
      });

      expect(result.success).toBe(true);
    });

    it('rejects empty studentIds array', () => {
      const result = batchUpdateStudentStatusSchema.safeParse({
        studentIds: [],
        status: 'active',
        effectiveDate: '2026-09-07',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.studentIds).toBeDefined();
      }
    });
  });

  describe('batchReassignStudentCohortSchema', () => {
    it('accepts valid cohort reassignment payload', () => {
      const result = batchReassignStudentCohortSchema.safeParse({
        studentIds: [validUuid1, validUuid2],
        targetCohortId: validCohortId,
        effectiveDate: '2026-09-07',
        reason: 'Repeating semester with junior cohort',
        notes: 'HOD approval granted',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid cohort identifier', () => {
      const result = batchReassignStudentCohortSchema.safeParse({
        studentIds: [validUuid1],
        targetCohortId: 'not-a-uuid',
        effectiveDate: '2026-09-07',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.targetCohortId).toBeDefined();
      }
    });

    it('rejects invalid effective date format', () => {
      const result = batchReassignStudentCohortSchema.safeParse({
        studentIds: [validUuid1],
        targetCohortId: validCohortId,
        effectiveDate: '07-09-2026',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.effectiveDate).toBeDefined();
      }
    });
  });
});
