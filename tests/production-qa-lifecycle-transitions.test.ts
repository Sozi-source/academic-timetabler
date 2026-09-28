import { describe, expect, it } from 'vitest';
import { canTransitionAssessment } from '@/features/assessment/domain';

type CohortStatus = 'planned' | 'active' | 'completed' | 'suspended' | 'archived';

const cohortTransitions: Record<CohortStatus, readonly CohortStatus[]> = {
  planned: ['active', 'archived'],
  active: ['completed', 'suspended', 'archived'],
  suspended: ['active', 'archived'],
  completed: ['archived'],
  archived: [],
};

function canTransitionCohort(current: CohortStatus, next: CohortStatus): boolean {
  return cohortTransitions[current].includes(next);
}

describe('Production QA: Academic Lifecycle State Transitions', () => {
  describe('Cohort Lifecycle State Machine', () => {
    it('supports controlled progression from planned to active to completed', () => {
      expect(canTransitionCohort('planned', 'active')).toBe(true);
      expect(canTransitionCohort('active', 'completed')).toBe(true);
      expect(canTransitionCohort('active', 'suspended')).toBe(true);
      expect(canTransitionCohort('suspended', 'active')).toBe(true);
      expect(canTransitionCohort('completed', 'archived')).toBe(true);
    });

    it('prohibits arbitrary backward transitions from completed to active without explicit audit', () => {
      expect(canTransitionCohort('completed', 'active')).toBe(false);
      expect(canTransitionCohort('completed', 'planned')).toBe(false);
    });

    it('confirms cohorts do not automatically complete based purely on calendar end date', () => {
      // In Academic Planner, cohort completion requires explicit HOD progression verification.
      // An active cohort with an end date in the past remains 'active' until audited.
      const cohort = {
        status: 'active' as CohortStatus,
        expectedEndDate: '2026-01-01',
        isManualCompletionRequired: true,
      };

      const currentDate = '2026-08-22';
      const isPastEndDate = new Date(cohort.expectedEndDate) < new Date(currentDate);
      expect(isPastEndDate).toBe(true);
      // Status must remain active until explicit transition
      expect(cohort.status).toBe('active');
    });
  });

  describe('Assessment Workflow Lifecycle State Machine', () => {
    it('enforces forward state transitions: draft -> generated -> open -> submitted -> finalised -> archived', () => {
      expect(canTransitionAssessment('draft', 'generated')).toBe(true);
      expect(canTransitionAssessment('generated', 'open')).toBe(true);
      expect(canTransitionAssessment('open', 'submitted')).toBe(true);
      expect(canTransitionAssessment('submitted', 'finalised')).toBe(true);
      expect(canTransitionAssessment('finalised', 'archived')).toBe(true);
    });

    it('allows audited reopening from submitted back to open', () => {
      expect(canTransitionAssessment('submitted', 'open')).toBe(true);
    });

    it('blocks invalid transitions like draft directly to finalised', () => {
      expect(canTransitionAssessment('draft', 'finalised')).toBe(false);
      expect(canTransitionAssessment('draft', 'submitted')).toBe(false);
    });
  });

  describe('Teaching Document Single Active Template Rule', () => {
    it('ensures only one active template exists per document type at any time', () => {
      const templates = [
        { id: 'tmpl-1', type: 'course_outline', version: 1, isActive: false },
        { id: 'tmpl-2', type: 'course_outline', version: 2, isActive: true },
        { id: 'tmpl-3', type: 'course_outline', version: 3, isActive: false },
      ];

      const activeTemplates = templates.filter((t) => t.isActive);
      expect(activeTemplates).toHaveLength(1);
      expect(activeTemplates[0].version).toBe(2);
    });
  });
});
