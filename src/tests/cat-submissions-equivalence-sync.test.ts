import { describe, expect, it } from 'vitest';
import type { AssessmentControlCenterItem, AssessmentSubmissionTrackerRow } from '@/features/assessment/control-center-queries';

describe('CAT Submissions & Equivalence Sibling Resolution', () => {
  it('recognizes unit-wide submissions (cohortId: null) for students with specific cohortId', () => {
    const submissions = [
      { cohortId: null, component: 'cat', submittedAt: '2026-11-10T12:00:00Z' },
    ];

    function componentIsSubmitted(
      component: string,
      cohortId: string | null,
    ) {
      return submissions.some(
        (submission) =>
          submission.component === component &&
          (cohortId === null || submission.cohortId === null || submission.cohortId === cohortId),
      );
    }

    // A student belonging to cohort-123 should be recognized as submitted
    expect(componentIsSubmitted('cat', 'cohort-123')).toBe(true);
    // A student with null cohortId should also be recognized
    expect(componentIsSubmitted('cat', null)).toBe(true);
    // Unsubmitted component should return false
    expect(componentIsSubmitted('exam', 'cohort-123')).toBe(false);
  });

  it('preserves Submitted status when multiple cohort rows exist for the same component', () => {
    const rawSubmissions: AssessmentSubmissionTrackerRow[] = [
      {
        id: 'sub-1',
        assessmentId: 'event-1',
        unit: 'Nutrition',
        unitCode: 'DND 1103',
        cohort: 'Cohort A',
        component: 'CAT',
        status: 'Submitted',
        submittedAt: '2026-11-10T10:00:00Z',
        submittedBy: 'Trainer Jane',
      },
      {
        id: 'sub-2',
        assessmentId: 'event-1',
        unit: 'Nutrition',
        unitCode: 'DND 1103',
        cohort: 'Cohort B',
        component: 'CAT',
        status: 'In progress',
        submittedAt: null,
        submittedBy: null,
      },
    ];

    const map = new Map<string, Map<string, AssessmentSubmissionTrackerRow>>();
    for (const sub of rawSubmissions) {
      let forEvent = map.get(sub.assessmentId);
      if (!forEvent) {
        forEvent = new Map();
        map.set(sub.assessmentId, forEvent);
      }
      const key = sub.component.toUpperCase();
      const existing = forEvent.get(key);
      if (!existing || sub.status === 'Submitted' || existing.status !== 'Submitted') {
        forEvent.set(key, sub);
      }
    }

    const eventSubs = map.get('event-1');
    const catSub = eventSubs?.get('CAT');
    expect(catSub?.status).toBe('Submitted');
    expect(catSub?.submittedAt).toBe('2026-11-10T10:00:00Z');
  });

  it('marks deliverable as Submitted when at least one sibling event in equivalence group has CAT submitted', () => {
    // Sibling items in the same equivalence group
    const items: AssessmentControlCenterItem[] = [
      {
        id: 'event-1',
        unitId: 'unit-dnd-1103',
        equivalenceGroupId: 'eq-group-1',
        equivalentUnitIds: ['unit-dnd-1103', 'unit-cnd-1103'],
        equivalentUnitCodes: ['DND 1103', 'CND 1103'],
        canonicalUnitName: 'Principles of Human Nutrition',
        unitCode: 'DND 1103',
        unitName: 'Principles of Human Nutrition',
        academicPeriodId: 'period-sep-dec-2026',
        academicPeriodName: 'September-December 2026',
        cohortId: 'cohort-dnd-1',
        cohortName: 'DND Sept 2026',
        trainerNames: ['Trainer Alice'],
        populationCount: 20,
        populationLocked: true,
        populationLockedAt: '2026-10-01T08:00:00Z',
        marksSource: 'online',
        totalExpected: 20,
        satCount: 20,
        absentCount: 0,
        missingCount: 0,
        workflowStatus: 'draft',
        isSubmitted: false,
        submittedAt: null,
        catMarksFinalizedAt: '2026-11-10T14:30:00Z',
        isFinalised: false,
        finalisedAt: null,
        isPublished: false,
        publishedAt: null,
        trainerEntryOpen: true,
        trainerCatEntryOpen: true,
        trainerExamEntryOpen: false,
      },
      {
        id: 'event-2',
        unitId: 'unit-cnd-1103',
        equivalenceGroupId: 'eq-group-1',
        equivalentUnitIds: ['unit-dnd-1103', 'unit-cnd-1103'],
        equivalentUnitCodes: ['DND 1103', 'CND 1103'],
        canonicalUnitName: 'Principles of Human Nutrition',
        unitCode: 'CND 1103',
        unitName: 'Principles of Human Nutrition',
        academicPeriodId: 'period-sep-dec-2026',
        academicPeriodName: 'September-December 2026',
        cohortId: 'cohort-cnd-1',
        cohortName: 'CND Sept 2026',
        trainerNames: ['Trainer Alice'],
        populationCount: 15,
        populationLocked: true,
        populationLockedAt: '2026-10-01T08:00:00Z',
        marksSource: 'online',
        totalExpected: 15,
        satCount: 15,
        absentCount: 0,
        missingCount: 0,
        workflowStatus: 'draft',
        isSubmitted: false,
        submittedAt: null,
        catMarksFinalizedAt: null, // Sibling prior to sync
        isFinalised: false,
        finalisedAt: null,
        isPublished: false,
        publishedAt: null,
        trainerEntryOpen: true,
        trainerCatEntryOpen: true,
        trainerExamEntryOpen: false,
      },
    ];

    let catSubmittedCount = 0;
    let catInProgressCount = 0;

    for (const it of items) {
      const isCatSub = it.isSubmitted || it.isFinalised || Boolean(it.catMarksFinalizedAt);
      const isCatProg = !isCatSub && it.satCount > 0;

      if (isCatSub) {
        catSubmittedCount++;
      } else if (isCatProg) {
        catInProgressCount++;
      }
    }

    let catStatus: 'Submitted' | 'In Progress' | 'Not Started' = 'Not Started';
    if (catSubmittedCount > 0) {
      catStatus = 'Submitted';
    } else if (catInProgressCount > 0) {
      catStatus = 'In Progress';
    }

    // Because event-1 has CAT submitted, the unified deliverable should be 'Submitted', not 'In Progress'
    expect(catStatus).toBe('Submitted');
    expect(catSubmittedCount).toBe(1);
  });
});
