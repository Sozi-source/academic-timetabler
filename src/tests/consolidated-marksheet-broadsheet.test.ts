import { describe, expect, it } from 'vitest';
import type { ReportStudentRow } from '@/features/assessment/reports/queries';

describe('Consolidated Marksheets & Broadsheet Matrix Logic', () => {
  const sampleRows: ReportStudentRow[] = [
    // Student 1 (Cohort A) in Unit 1
    {
      eventId: 'event-1',
      unitId: 'unit-1',
      unitCode: 'CND 1201',
      unitName: 'Anatomy and Physiology',
      trainerName: 'Dr. Smith',
      studentId: 'student-1',
      admissionNumber: 'DHN/001',
      fullName: 'Alice Johnson',
      cohortId: 'cohort-a',
      cohortName: 'Cohort A',
      attendance: 'present',
      catReason: '',
      catRecommendation: '',
      examReason: '',
      examRecommendation: '',
      assignment: 5,
      presentation: 9,
      rat: 13,
      cat1: 14,
      exam: 55,
      total: 82.5,
      grade: 'DISTINCTION',
    },
    // Student 1 (Cohort A) in Unit 2
    {
      eventId: 'event-2',
      unitId: 'unit-2',
      unitCode: 'CND 1202',
      unitName: 'Food Microbiology',
      trainerName: 'Dr. Adams',
      studentId: 'student-1',
      admissionNumber: 'DHN/001',
      fullName: 'Alice Johnson',
      cohortId: 'cohort-a',
      cohortName: 'Cohort A',
      attendance: 'present',
      catReason: '',
      catRecommendation: '',
      examReason: '',
      examRecommendation: '',
      assignment: 4,
      presentation: 8,
      rat: 12,
      cat1: 12,
      exam: 46,
      total: 70,
      grade: 'CREDIT',
    },
    // Student 2 (Cohort A) in Unit 1
    {
      eventId: 'event-1',
      unitId: 'unit-1',
      unitCode: 'CND 1201',
      unitName: 'Anatomy and Physiology',
      trainerName: 'Dr. Smith',
      studentId: 'student-2',
      admissionNumber: 'DHN/002',
      fullName: 'Bob Williams',
      cohortId: 'cohort-a',
      cohortName: 'Cohort A',
      attendance: 'present',
      catReason: '',
      catRecommendation: '',
      examReason: '',
      examRecommendation: '',
      assignment: 3,
      presentation: 6,
      rat: 9,
      cat1: 9,
      exam: 25,
      total: 43,
      grade: 'PASS',
    },
    // Student 2 (Cohort A) in Unit 2 (Failed / Refer)
    {
      eventId: 'event-2',
      unitId: 'unit-2',
      unitCode: 'CND 1202',
      unitName: 'Food Microbiology',
      trainerName: 'Dr. Adams',
      studentId: 'student-2',
      admissionNumber: 'DHN/002',
      fullName: 'Bob Williams',
      cohortId: 'cohort-a',
      cohortName: 'Cohort A',
      attendance: 'present',
      catReason: '',
      catRecommendation: '',
      examReason: '',
      examRecommendation: '',
      assignment: 2,
      presentation: 5,
      rat: 8,
      cat1: 8,
      exam: 15,
      total: 30,
      grade: 'REFER',
    },
    // Student 3 (Cohort B) in Unit 1 (Shared Unit!)
    {
      eventId: 'event-1',
      unitId: 'unit-1',
      unitCode: 'CND 1201',
      unitName: 'Anatomy and Physiology',
      trainerName: 'Dr. Smith',
      studentId: 'student-3',
      admissionNumber: 'DHN/003',
      fullName: 'Charlie Davis',
      cohortId: 'cohort-b',
      cohortName: 'Cohort B',
      attendance: 'present',
      catReason: '',
      catRecommendation: '',
      examReason: '',
      examRecommendation: '',
      assignment: 4.5,
      presentation: 8.5,
      rat: 14,
      cat1: 13,
      exam: 50,
      total: 76.5,
      grade: 'DISTINCTION',
    },
  ];

  it('aggregates cohort broadsheet matrix with correct student unit mappings and overall status', () => {
    const cohortARows = sampleRows.filter((r) => r.cohortId === 'cohort-a');
    const studentMap = new Map<string, { totalScore: number; passedCount: number; scoredCount: number }>();

    for (const r of cohortARows) {
      if (!studentMap.has(r.studentId)) {
        studentMap.set(r.studentId, { totalScore: 0, passedCount: 0, scoredCount: 0 });
      }
      const s = studentMap.get(r.studentId)!;
      if (r.total !== null) {
        s.totalScore += r.total;
        s.scoredCount += 1;
        if (r.total >= 40) s.passedCount += 1;
      }
    }

    // Alice: Unit 1 = 82.5, Unit 2 = 70 -> total = 152.5, avg = 76.25, passed 2/2 -> PASS
    const alice = studentMap.get('student-1')!;
    expect(alice.scoredCount).toBe(2);
    expect(alice.passedCount).toBe(2);
    expect(alice.totalScore).toBe(152.5);
    expect(Math.round((alice.totalScore / alice.scoredCount) * 10) / 10).toBe(76.3);

    // Bob: Unit 1 = 43, Unit 2 = 30 -> total = 73, avg = 36.5, passed 1/2 -> REFER
    const bob = studentMap.get('student-2')!;
    expect(bob.scoredCount).toBe(2);
    expect(bob.passedCount).toBe(1);
    expect(bob.totalScore).toBe(73);
    expect(Math.round((bob.totalScore / bob.scoredCount) * 10) / 10).toBe(36.5);
  });

  it('aggregates consolidated unit marksheet across multiple cohorts taking the same unit', () => {
    // Unit 1 is shared by Cohort A (Alice, Bob) and Cohort B (Charlie)
    const unit1Rows = sampleRows.filter((r) => r.unitId === 'unit-1');
    expect(unit1Rows.length).toBe(3);

    const cohorts = new Set(unit1Rows.map((r) => r.cohortId));
    expect(cohorts.size).toBe(2);
    expect(cohorts.has('cohort-a')).toBe(true);
    expect(cohorts.has('cohort-b')).toBe(true);

    const sumTotal = unit1Rows.reduce((acc, r) => acc + (r.total ?? 0), 0);
    const meanTotal = Math.round((sumTotal / unit1Rows.length) * 10) / 10;
    // (82.5 + 43 + 76.5) / 3 = 202 / 3 = 67.3
    expect(meanTotal).toBe(67.3);

    const passedCount = unit1Rows.filter((r) => (r.total ?? 0) >= 40).length;
    expect(passedCount).toBe(3);
    const passRate = Math.round((passedCount / unit1Rows.length) * 100);
    expect(passRate).toBe(100);
  });

  it('correctly computes unit-by-unit averages in cohort broadsheet', () => {
    const cohortARows = sampleRows.filter((r) => r.cohortId === 'cohort-a');
    const unit1Marks = cohortARows.filter((r) => r.unitId === 'unit-1').map((r) => r.total ?? 0);
    const unit2Marks = cohortARows.filter((r) => r.unitId === 'unit-2').map((r) => r.total ?? 0);

    // Unit 1 in Cohort A: (82.5 + 43) / 2 = 62.75 -> 62.8
    const unit1Avg = Math.round((unit1Marks.reduce((a, b) => a + b, 0) / unit1Marks.length) * 10) / 10;
    expect(unit1Avg).toBe(62.8);

    // Unit 2 in Cohort A: (70 + 30) / 2 = 50
    const unit2Avg = Math.round((unit2Marks.reduce((a, b) => a + b, 0) / unit2Marks.length) * 10) / 10;
    expect(unit2Avg).toBe(50);
  });
});
