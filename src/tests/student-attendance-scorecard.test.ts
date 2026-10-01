import { describe, expect, it } from 'vitest';

import {
  attendanceRate,
  attendanceRateLabel,
  getAttendanceBadgeVariant,
  getAttendanceStanding,
  getAttendanceStandingLabel,
} from '@/features/attendance-analytics/domain';
import type {
  StudentAttendanceScorecardItem,
  StudentUnitAttendanceScore,
} from '@/features/class-attendance/scorecard-types';

describe('student attendance scorecard domain logic', () => {
  it('correctly calculates attendance rate percentages for individual units', () => {
    // 18 present out of 20 sessions = 90.0%
    const rate1 = attendanceRate({ present: 18, absent: 2 });
    expect(rate1).toBe(90.0);
    expect(attendanceRateLabel(rate1)).toBe('90.0%');

    // 14 present out of 20 sessions = 70.0%
    const rate2 = attendanceRate({ present: 14, absent: 6 });
    expect(rate2).toBe(70.0);
    expect(attendanceRateLabel(rate2)).toBe('70.0%');

    // 0 sessions held = null
    const rateEmpty = attendanceRate({ present: 0, absent: 0 });
    expect(rateEmpty).toBeNull();
    expect(attendanceRateLabel(rateEmpty)).toBe('—');
  });

  it('accurately classifies attendance standing thresholds', () => {
    // < 80% is At Risk (below college mandatory policy)
    expect(getAttendanceStanding(79.9)).toBe('at_risk');
    expect(getAttendanceStanding(65.0)).toBe('at_risk');
    expect(getAttendanceStanding(0)).toBe('at_risk');
    expect(getAttendanceStandingLabel('at_risk')).toBe('At Risk (< 80%)');
    expect(getAttendanceBadgeVariant(79.9)).toBe('danger');

    // 80% to 84.9% is Borderline
    expect(getAttendanceStanding(80.0)).toBe('borderline');
    expect(getAttendanceStanding(84.9)).toBe('borderline');
    expect(getAttendanceStandingLabel('borderline')).toBe('Borderline (Cleared)');
    expect(getAttendanceBadgeVariant(80.0)).toBe('warning');

    // >= 85% is Good Standing
    expect(getAttendanceStanding(85.0)).toBe('good');
    expect(getAttendanceStanding(100.0)).toBe('good');
    expect(getAttendanceStandingLabel('good')).toBe('In Good Standing');
    expect(getAttendanceBadgeVariant(85.0)).toBe('success');

    // Unrecorded
    expect(getAttendanceStanding(null)).toBe('unrecorded');
    expect(getAttendanceStandingLabel('unrecorded')).toBe('Unrecorded');
    expect(getAttendanceBadgeVariant(null)).toBe('neutral');
  });

  it('aggregates multi-unit attendance scores and calculates student overall score', () => {
    const units: StudentUnitAttendanceScore[] = [
      {
        unitId: 'unit-1',
        unitCode: 'DND 1101',
        unitName: 'Human Anatomy',
        completedSessions: 10,
        presentCount: 10,
        absentCount: 0,
        attendanceRate: 100.0,
      },
      {
        unitId: 'unit-2',
        unitCode: 'DND 1102',
        unitName: 'Nutritional Biochemistry',
        completedSessions: 10,
        presentCount: 8,
        absentCount: 2,
        attendanceRate: 80.0,
      },
      {
        unitId: 'unit-3',
        unitCode: 'DND 1103',
        unitName: 'Diet Therapy',
        completedSessions: 10,
        presentCount: 6,
        absentCount: 4,
        attendanceRate: 60.0,
      },
      {
        unitId: 'unit-4',
        unitCode: 'DND 1104',
        unitName: 'Food Microbiology',
        completedSessions: 0,
        presentCount: 0,
        absentCount: 0,
        attendanceRate: null, // No sessions held yet
      },
    ];

    const totalPresent = units.reduce((acc, u) => acc + u.presentCount, 0);
    const totalAbsent = units.reduce((acc, u) => acc + u.absentCount, 0);
    const totalCompleted = units.reduce((acc, u) => acc + u.completedSessions, 0);

    expect(totalPresent).toBe(24);
    expect(totalAbsent).toBe(6);
    expect(totalCompleted).toBe(30);

    const overallScore = attendanceRate({ present: totalPresent, absent: totalAbsent });
    // 24 present out of 30 marked = 80.0%
    expect(overallScore).toBe(80.0);
    expect(getAttendanceStanding(overallScore)).toBe('borderline');

    const scorecardItem: StudentAttendanceScorecardItem = {
      studentId: 'st-1',
      admissionNumber: 'DND/2026/001',
      fullName: 'Alice Jane',
      cohortId: 'cohort-1',
      cohortName: 'DND JAN 2026',
      programmeCode: 'DND',
      programmeName: 'Diploma in Nutrition and Dietetics',
      units,
      totalCompletedSessions: totalCompleted,
      totalPresent,
      totalAbsent,
      overallScore,
      standing: getAttendanceStanding(overallScore),
    };

    expect(scorecardItem.units).toHaveLength(4);
    expect(scorecardItem.overallScore).toBe(80.0);
    expect(scorecardItem.standing).toBe('borderline');
  });

  it('correctly filters out unrecorded units when calculating average scores', () => {
    const unitsWithNoSessions: StudentUnitAttendanceScore[] = [
      {
        unitId: 'unit-1',
        unitCode: 'DND 1101',
        unitName: 'Human Anatomy',
        completedSessions: 0,
        presentCount: 0,
        absentCount: 0,
        attendanceRate: null,
      },
      {
        unitId: 'unit-2',
        unitCode: 'DND 1102',
        unitName: 'Nutritional Biochemistry',
        completedSessions: 0,
        presentCount: 0,
        absentCount: 0,
        attendanceRate: null,
      },
    ];

    const totalPresent = unitsWithNoSessions.reduce((acc, u) => acc + u.presentCount, 0);
    const totalAbsent = unitsWithNoSessions.reduce((acc, u) => acc + u.absentCount, 0);
    const overallScore = attendanceRate({ present: totalPresent, absent: totalAbsent });

    expect(overallScore).toBeNull();
    expect(getAttendanceStanding(overallScore)).toBe('unrecorded');
    expect(attendanceRateLabel(overallScore)).toBe('—');
  });
});
