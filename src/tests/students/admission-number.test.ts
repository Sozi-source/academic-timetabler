import { describe, expect, it } from 'vitest';

import { inferStudentAdmissionNumber } from '@/features/students/admission-number';

describe('inferStudentAdmissionNumber', () => {
  it('preserves January admission intake while mapping it to the JAN-MAR progression group', () => {
    expect(inferStudentAdmissionNumber('CND/J-5678/IC/26')).toEqual({
      normalized: 'CND/J-5678/IC/26',
      programmeCode: 'CND',
      intakeCode: 'J',
      intakeLabel: 'JAN',
      admissionYear: 2026,
      serialNumber: '5678',
      confidence: 'high',
      suggestedCohortCode: 'CND JAN 26',
      progressionGroupLabel: 'JAN-MAR',
      suggestedProgressionCohortCode: 'CND JAN-MAR 26',
    });
  });

  it('preserves March admission intake while mapping it to the same JAN-MAR progression group', () => {
    const result = inferStudentAdmissionNumber('CHN/MAR-5256/IC/25');
    expect(result.intakeLabel).toBe('MAR');
    expect(result.suggestedCohortCode).toBe('CHN MAR 25');
    expect(result.progressionGroupLabel).toBe('JAN-MAR');
    expect(result.suggestedProgressionCohortCode).toBe('CHN JAN-MAR 25');
  });

  it('keeps May and September as independent progression groups', () => {
    const may = inferStudentAdmissionNumber('CND/M-1001/IC/26');
    const sep = inferStudentAdmissionNumber('CND/S-1002/IC/26');
    expect(may.intakeLabel).toBe('MAY');
    expect(may.progressionGroupLabel).toBe('MAY');
    expect(sep.intakeLabel).toBe('SEP');
    expect(sep.progressionGroupLabel).toBe('SEP');
  });

  it('keeps unknown intake codes as partial evidence', () => {
    const result = inferStudentAdmissionNumber('CND/X-1234/IC/26');
    expect(result.confidence).toBe('partial');
    expect(result.intakeCode).toBe('X');
    expect(result.suggestedCohortCode).toBeNull();
    expect(result.progressionGroupLabel).toBeNull();
  });

  it('does not manufacture academic identity from malformed values', () => {
    const result = inferStudentAdmissionNumber('NOT-AN-ADMISSION-NUMBER');
    expect(result.confidence).toBe('none');
    expect(result.suggestedCohortCode).toBeNull();
    expect(result.suggestedProgressionCohortCode).toBeNull();
  });
});
