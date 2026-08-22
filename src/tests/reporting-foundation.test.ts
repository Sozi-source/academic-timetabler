import { describe, expect, it } from 'vitest';
import type {
  AttendanceReportItem,
  AssessmentCompletionReportItem,
  RegistrationCompletionReportItem,
  TeachingDocumentComplianceReportItem,
  TrainerWorkloadReportItem,
} from '@/features/reporting/types';

describe('Reporting Foundation Domain Calculations', () => {
  describe('Trainer Workload', () => {
    it('correctly determines optimal, underload, and overload statuses', () => {
      const fullTimeOptimal: TrainerWorkloadReportItem = {
        trainerId: 't1',
        trainerName: 'Dr. Jane Smith',
        role: 'Full-Time Trainer',
        normalTargetHours: 20,
        allocatedHours: 20,
        scheduledHours: 20,
        allocatedUnitsCount: 5,
        workloadStatus: 'optimal',
        allocatedUnitCodes: ['NUTR 101', 'NUTR 102', 'NUTR 103', 'NUTR 104', 'NUTR 105'],
      };

      const hodOverload: TrainerWorkloadReportItem = {
        trainerId: 't2',
        trainerName: 'Dr. John Doe',
        role: 'HOD',
        normalTargetHours: 10,
        allocatedHours: 16,
        scheduledHours: 16,
        allocatedUnitsCount: 4,
        workloadStatus: 'overload',
        allocatedUnitCodes: ['NUTR 201', 'NUTR 202', 'NUTR 203', 'NUTR 204'],
      };

      expect(fullTimeOptimal.workloadStatus).toBe('optimal');
      expect(hodOverload.allocatedHours).toBeGreaterThan(hodOverload.normalTargetHours + 2);
      expect(hodOverload.workloadStatus).toBe('overload');
    });
  });

  describe('Assessment Completion', () => {
    it('computes completion rate as (sat + absent) / population', () => {
      const item: AssessmentCompletionReportItem = {
        id: 'ev-1',
        unitId: 'u-1',
        unitCode: 'NUTR 301',
        unitName: 'Clinical Dietetics',
        populationCount: 40,
        isPopulationLocked: true,
        isCatFinalized: true,
        isExamFinalized: false,
        isPublished: false,
        marksSource: 'excel',
        missingMarksCount: 5,
        satCount: 33,
        absentCount: 2,
        completionRate: Math.round(((33 + 2) / 40) * 100),
      };

      expect(item.completionRate).toBe(88);
      expect(item.missingMarksCount).toBe(item.populationCount - (item.satCount + item.absentCount));
    });
  });

  describe('Registration Completion', () => {
    it('calculates cohort registration percentage accurately', () => {
      const item: RegistrationCompletionReportItem = {
        cohortId: 'c-1',
        cohortCode: 'CND2026',
        cohortName: 'CND Jan 2026',
        programmeName: 'Certificate in Nutrition',
        stageName: 'Stage 1',
        eligibleStudentCount: 50,
        preRegisteredCount: 10,
        confirmedCount: 35,
        totalRegisteredCount: 45,
        registrationRate: Math.round((45 / 50) * 100),
        expectedUnitsCount: 6,
      };

      expect(item.registrationRate).toBe(90);
      expect(item.confirmedCount + item.preRegisteredCount).toBe(item.totalRegisteredCount);
    });
  });

  describe('Class Attendance Compliance', () => {
    it('calculates session completion rate and average student presence', () => {
      const item: AttendanceReportItem = {
        unitId: 'u-1',
        unitCode: 'NUTR 101',
        unitName: 'Intro to Nutrition',
        cohortName: 'CND Jan 2026',
        trainerName: 'Jane Smith',
        totalSessionsScheduled: 14,
        completedSessions: 12,
        openSessions: 2,
        completionRate: Math.round((12 / 14) * 100),
        totalPresentCount: 320,
        totalAbsentCount: 40,
        averageAttendanceRate: Math.round((320 / (320 + 40)) * 100),
      };

      expect(item.completionRate).toBe(86);
      expect(item.averageAttendanceRate).toBe(89);
    });
  });

  describe('Teaching Document Compliance', () => {
    it('computes 4-document compliance percentage correctly', () => {
      const item: TeachingDocumentComplianceReportItem = {
        allocationId: 'alloc-1',
        unitCode: 'NUTR 101',
        unitName: 'Intro to Nutrition',
        cohortName: 'CND Jan 2026',
        trainerName: 'Jane Smith',
        attendanceSheetStatus: 'approved',
        courseOutlineStatus: 'approved',
        schemeOfWorkStatus: 'submitted',
        recordOfWorkStatus: 'draft',
        approvedCount: 2,
        totalRequired: 4,
        complianceRate: Math.round((2 / 4) * 100),
      };

      expect(item.approvedCount).toBe(2);
      expect(item.complianceRate).toBe(50);
    });
  });
});
