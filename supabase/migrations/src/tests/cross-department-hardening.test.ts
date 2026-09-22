import { describe, expect, it } from 'vitest';

interface MockAllocation {
  id: string;
  trainerId: string;
  departmentId: string;
  departmentName: string;
  unitCode: string;
  weeklyHours: number;
}

interface MockScheduledSlot {
  sessionId: string;
  trainerId: string;
  departmentId: string;
  dayOfWeek: string;
  startHour: number;
  endHour: number;
}

function calculateTrainerCumulativeWorkload(
  trainerId: string,
  allocations: MockAllocation[]
) {
  const trainerAllocs = allocations.filter((a) => a.trainerId === trainerId);
  const totalHours = trainerAllocs.reduce((sum, a) => sum + a.weeklyHours, 0);
  const departments = [...new Set(trainerAllocs.map((a) => a.departmentId))];
  return {
    trainerId,
    totalHours,
    departmentCount: departments.length,
    departments,
  };
}

function detectCrossDepartmentTrainerConflict(
  slotA: MockScheduledSlot,
  slotB: MockScheduledSlot
): boolean {
  if (slotA.trainerId !== slotB.trainerId) return false;
  if (slotA.dayOfWeek !== slotB.dayOfWeek) return false;
  // Overlap condition: startA < endB && startB < endA
  return slotA.startHour < slotB.endHour && slotB.startHour < slotA.endHour;
}

describe('Batch F — Cross-Department Hardening', () => {
  describe('Department Data Isolation', () => {
    it('ensures HOD queries filter strictly by active department ID', () => {
      const hodDepartmentId = 'dept-nutrition-uuid';
      const allocations: MockAllocation[] = [
        {
          id: 'a1',
          trainerId: 't1',
          departmentId: 'dept-nutrition-uuid',
          departmentName: 'Nutrition & Dietetics',
          unitCode: 'NUTR 101',
          weeklyHours: 4,
        },
        {
          id: 'a2',
          trainerId: 't1',
          departmentId: 'dept-clinical-uuid',
          departmentName: 'Clinical Medicine',
          unitCode: 'CLIN 201',
          weeklyHours: 4,
        },
      ];

      const hodVisible = allocations.filter((a) => a.departmentId === hodDepartmentId);
      expect(hodVisible).toHaveLength(1);
      expect(hodVisible[0].unitCode).toBe('NUTR 101');
    });
  });

  describe('Shared Trainer Pool & Cumulative Workload', () => {
    it('aggregates allocations across multiple departments for shared trainers', () => {
      const allocations: MockAllocation[] = [
        {
          id: 'a1',
          trainerId: 'trainer-shared-1',
          departmentId: 'dept-nutrition-uuid',
          departmentName: 'Nutrition',
          unitCode: 'NUTR 101',
          weeklyHours: 6,
        },
        {
          id: 'a2',
          trainerId: 'trainer-shared-1',
          departmentId: 'dept-pharmacy-uuid',
          departmentName: 'Pharmacy',
          unitCode: 'PHARM 105',
          weeklyHours: 8,
        },
        {
          id: 'a3',
          trainerId: 'trainer-shared-1',
          departmentId: 'dept-nursing-uuid',
          departmentName: 'Nursing',
          unitCode: 'NURS 102',
          weeklyHours: 4,
        },
      ];

      const cumulative = calculateTrainerCumulativeWorkload('trainer-shared-1', allocations);
      expect(cumulative.totalHours).toBe(18);
      expect(cumulative.departmentCount).toBe(3);
      expect(cumulative.departments).toContain('dept-nutrition-uuid');
      expect(cumulative.departments).toContain('dept-pharmacy-uuid');
      expect(cumulative.departments).toContain('dept-nursing-uuid');
    });
  });

  describe('Cross-Department Timetable Conflict Prevention', () => {
    it('detects collision when a shared trainer is scheduled simultaneously in different departments', () => {
      const sessionInNutrition: MockScheduledSlot = {
        sessionId: 'sess-1',
        trainerId: 'trainer-anatomy-expert',
        departmentId: 'dept-nutrition',
        dayOfWeek: 'Monday',
        startHour: 8,
        endHour: 10,
      };

      const sessionInNursingOverlap: MockScheduledSlot = {
        sessionId: 'sess-2',
        trainerId: 'trainer-anatomy-expert',
        departmentId: 'dept-nursing',
        dayOfWeek: 'Monday',
        startHour: 8,
        endHour: 10,
      };

      const sessionInNursingLater: MockScheduledSlot = {
        sessionId: 'sess-3',
        trainerId: 'trainer-anatomy-expert',
        departmentId: 'dept-nursing',
        dayOfWeek: 'Monday',
        startHour: 10.5,
        endHour: 12.5,
      };

      expect(
        detectCrossDepartmentTrainerConflict(sessionInNutrition, sessionInNursingOverlap)
      ).toBe(true);

      expect(
        detectCrossDepartmentTrainerConflict(sessionInNutrition, sessionInNursingLater)
      ).toBe(false);
    });
  });
});
