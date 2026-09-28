import { describe, expect, it } from 'vitest';

import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';

describe('admission number ordering', () => {
  it('orders candidates by the incremental admission sequence across prefixes', () => {
    const admissionNumbers = [
      'DNDT/J-7189/IC/26',
      'DHNT/S-6655/IC/25',
      'DNDT/J-7021/IC/26',
      'DHN/MAR-3449/IC/24',
    ];

    expect(admissionNumbers.sort(compareAdmissionNumbers)).toEqual([
      'DHN/MAR-3449/IC/24',
      'DHNT/S-6655/IC/25',
      'DNDT/J-7021/IC/26',
      'DNDT/J-7189/IC/26',
    ]);
  });

  it('normalizes spacing before comparing equivalent prefixes', () => {
    const admissionNumbers = ['DSL/MAR- 5309/IC/25', 'DSL/MAR-5279/IC/25'];
    expect(admissionNumbers.sort(compareAdmissionNumbers)).toEqual([
      'DSL/MAR-5279/IC/25',
      'DSL/MAR- 5309/IC/25',
    ]);
  });
});

