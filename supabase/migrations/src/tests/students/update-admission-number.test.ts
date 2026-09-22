import { describe, expect, it } from 'vitest';

import { inferStudentAdmissionNumber } from '@/features/students/admission-number';
import { updateAdmissionNumberSchema } from '@/features/students/validation';

describe('updateAdmissionNumberSchema', () => {
  const validStudentId = '11111111-1111-4111-8111-111111111111';

  it('accepts valid admission numbers and normalizes them to uppercase', () => {
    const parsed = updateAdmissionNumberSchema.safeParse({
      studentId: validStudentId,
      admissionNumber: 'cnd/j-5678/ic/26',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.admissionNumber).toBe('CND/J-5678/IC/26');
      expect(parsed.data.studentId).toBe(validStudentId);
    }
  });

  it('collapses multiple whitespace characters and trims surrounding whitespace', () => {
    const parsed = updateAdmissionNumberSchema.safeParse({
      studentId: validStudentId,
      admissionNumber: '  cnd/j-1234/ic/26   ',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.admissionNumber).toBe('CND/J-1234/IC/26');
    }
  });

  it('rejects an admission number that is too short (< 3 characters)', () => {
    const parsed = updateAdmissionNumberSchema.safeParse({
      studentId: validStudentId,
      admissionNumber: 'NO',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.admissionNumber?.[0]).toContain('at least 3 characters');
    }
  });

  it('rejects an admission number that exceeds 80 characters', () => {
    const parsed = updateAdmissionNumberSchema.safeParse({
      studentId: validStudentId,
      admissionNumber: 'A'.repeat(81),
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.admissionNumber?.[0]).toContain('cannot exceed 80 characters');
    }
  });

  it('rejects an invalid student UUID', () => {
    const parsed = updateAdmissionNumberSchema.safeParse({
      studentId: 'not-a-valid-uuid',
      admissionNumber: 'CND/J-5678/IC/26',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.studentId?.[0]).toContain('valid student identifier');
    }
  });

  it('accepts optional reason and notes under character limits', () => {
    const parsed = updateAdmissionNumberSchema.safeParse({
      studentId: validStudentId,
      admissionNumber: 'CND/J-5678/IC/26',
      reason: 'Typo in uploaded batch file',
      notes: 'Corrected per registry physical file confirmation',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reason).toBe('Typo in uploaded batch file');
      expect(parsed.data.notes).toBe('Corrected per registry physical file confirmation');
    }
  });

  it('rejects reason exceeding 500 characters', () => {
    const parsed = updateAdmissionNumberSchema.safeParse({
      studentId: validStudentId,
      admissionNumber: 'CND/J-5678/IC/26',
      reason: 'x'.repeat(501),
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.reason?.[0]).toContain('below 500 characters');
    }
  });
});

describe('inferStudentAdmissionNumber integration for corrected numbers', () => {
  it('correctly extracts programme, intake, and cohort from corrected TVET numbers', () => {
    const corrected = inferStudentAdmissionNumber('CND/J-9999/IC/26');
    expect(corrected.programmeCode).toBe('CND');
    expect(corrected.intakeLabel).toBe('JAN');
    expect(corrected.admissionYear).toBe(2026);
    expect(corrected.serialNumber).toBe('9999');
    expect(corrected.confidence).toBe('high');
    expect(corrected.suggestedCohortCode).toBe('CND JAN 26');
    expect(corrected.progressionGroupLabel).toBe('JAN-MAR');
  });

  it('correctly handles march intake mapping for corrected numbers', () => {
    const corrected = inferStudentAdmissionNumber('CHN/MAR-1234/IC/25');
    expect(corrected.programmeCode).toBe('CHN');
    expect(corrected.intakeLabel).toBe('MAR');
    expect(corrected.admissionYear).toBe(2025);
    expect(corrected.progressionGroupLabel).toBe('JAN-MAR');
    expect(corrected.suggestedProgressionCohortCode).toBe('CHN JAN-MAR 25');
  });
});
