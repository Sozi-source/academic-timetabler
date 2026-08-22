import { describe, expect, it } from 'vitest';

/**
 * Domain-level simulation representing the multi-portal timetable visibility contract.
 */

export interface SessionRecord {
  id: string;
  academicPeriodId: string;
  versionNumber: number;
  trainerId: string | null;
  cohortId: string;
  unitCode: string;
  unitName: string;
  status: 'draft' | 'locked' | 'cancelled';
  timetableStatus: 'draft' | 'published' | 'archived';
}

export interface Trainer {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  cohortId: string;
  registeredUnitCodes: string[];
}

/**
 * Resolver for Trainer Portal: Only returns sessions that are PUBLISHED (or locked) and belong to the trainer.
 */
export function getTrainerVisibleSessions(
  trainerId: string,
  allSessions: SessionRecord[],
): SessionRecord[] {
  return allSessions.filter(
    (s) =>
      s.trainerId === trainerId &&
      s.timetableStatus === 'published' &&
      s.status !== 'cancelled',
  );
}

/**
 * Resolver for Student Portal: Only returns sessions that are PUBLISHED (or locked) and match the student's cohort or registered units.
 */
export function getStudentVisibleSessions(
  student: Student,
  allSessions: SessionRecord[],
): SessionRecord[] {
  return allSessions.filter(
    (s) =>
      s.timetableStatus === 'published' &&
      s.status !== 'cancelled' &&
      (s.cohortId === student.cohortId ||
        student.registeredUnitCodes.includes(s.unitCode)),
  );
}

/**
 * Resolver for HOD/Admin Portal: Sees all sessions in the department across draft, published, and archived versions.
 */
export function getHodVisibleSessions(
  allSessions: SessionRecord[],
  filter?: { timetableStatus?: 'draft' | 'published' | 'archived' },
): SessionRecord[] {
  if (!filter?.timetableStatus) return allSessions;
  return allSessions.filter((s) => s.timetableStatus === filter.timetableStatus);
}

describe('Multi-Portal Timetable Synchronization & Visibility Contract', () => {
  const trainerA: Trainer = { id: 'trainer-1', name: 'Dr. Alice' };
  const trainerB: Trainer = { id: 'trainer-2', name: 'Dr. Bob' };

  const studentCohortA: Student = {
    id: 'stud-1',
    cohortId: 'cohort-dnd-1',
    registeredUnitCodes: ['NUT101', 'BIO102'],
  };

  const studentCohortB: Student = {
    id: 'stud-2',
    cohortId: 'cohort-cnd-2',
    registeredUnitCodes: ['NUT201'],
  };

  it('Property 1: Published -> Trainer visible & Student visible', () => {
    const publishedSessions: SessionRecord[] = [
      {
        id: 'sess-1',
        academicPeriodId: 'period-1',
        versionNumber: 1,
        trainerId: trainerA.id,
        cohortId: 'cohort-dnd-1',
        unitCode: 'NUT101',
        unitName: 'Clinical Nutrition I',
        status: 'locked',
        timetableStatus: 'published',
      },
    ];

    const trainerSessions = getTrainerVisibleSessions(trainerA.id, publishedSessions);
    expect(trainerSessions).toHaveLength(1);
    expect(trainerSessions[0].unitCode).toBe('NUT101');

    const studentSessions = getStudentVisibleSessions(studentCohortA, publishedSessions);
    expect(studentSessions).toHaveLength(1);
    expect(studentSessions[0].unitCode).toBe('NUT101');
  });

  it('Property 2: Draft -> Trainer hidden & Student hidden', () => {
    const draftSessions: SessionRecord[] = [
      {
        id: 'sess-draft-1',
        academicPeriodId: 'period-1',
        versionNumber: 1,
        trainerId: trainerA.id,
        cohortId: 'cohort-dnd-1',
        unitCode: 'NUT101',
        unitName: 'Clinical Nutrition I',
        status: 'draft',
        timetableStatus: 'draft',
      },
    ];

    // Trainer cannot see unreleased draft sessions
    const trainerSessions = getTrainerVisibleSessions(trainerA.id, draftSessions);
    expect(trainerSessions).toHaveLength(0);

    // Student cannot see unreleased draft sessions
    const studentSessions = getStudentVisibleSessions(studentCohortA, draftSessions);
    expect(studentSessions).toHaveLength(0);

    // But HOD can still see and edit the draft
    const hodSessions = getHodVisibleSessions(draftSessions);
    expect(hodSessions).toHaveLength(1);
  });

  it('Property 3: Trainer sees ONLY their own allocated sessions', () => {
    const publishedSchedule: SessionRecord[] = [
      {
        id: 'sess-1',
        academicPeriodId: 'period-1',
        versionNumber: 1,
        trainerId: trainerA.id,
        cohortId: 'cohort-dnd-1',
        unitCode: 'NUT101',
        unitName: 'Clinical Nutrition I',
        status: 'locked',
        timetableStatus: 'published',
      },
      {
        id: 'sess-2',
        academicPeriodId: 'period-1',
        versionNumber: 1,
        trainerId: trainerB.id,
        cohortId: 'cohort-cnd-2',
        unitCode: 'NUT201',
        unitName: 'Diet Therapy II',
        status: 'locked',
        timetableStatus: 'published',
      },
    ];

    const trainerASessions = getTrainerVisibleSessions(trainerA.id, publishedSchedule);
    expect(trainerASessions).toHaveLength(1);
    expect(trainerASessions[0].trainerId).toBe(trainerA.id);

    const trainerBSessions = getTrainerVisibleSessions(trainerB.id, publishedSchedule);
    expect(trainerBSessions).toHaveLength(1);
    expect(trainerBSessions[0].trainerId).toBe(trainerB.id);
  });

  it('Property 4: Student sees ONLY their own cohort or registered units', () => {
    const publishedSchedule: SessionRecord[] = [
      {
        id: 'sess-1',
        academicPeriodId: 'period-1',
        versionNumber: 1,
        trainerId: trainerA.id,
        cohortId: 'cohort-dnd-1',
        unitCode: 'NUT101',
        unitName: 'Clinical Nutrition I',
        status: 'locked',
        timetableStatus: 'published',
      },
      {
        id: 'sess-2',
        academicPeriodId: 'period-1',
        versionNumber: 1,
        trainerId: trainerB.id,
        cohortId: 'cohort-cnd-2',
        unitCode: 'NUT201',
        unitName: 'Diet Therapy II',
        status: 'locked',
        timetableStatus: 'published',
      },
    ];

    const studentASessions = getStudentVisibleSessions(studentCohortA, publishedSchedule);
    expect(studentASessions).toHaveLength(1);
    expect(studentASessions[0].cohortId).toBe('cohort-dnd-1');

    const studentBSessions = getStudentVisibleSessions(studentCohortB, publishedSchedule);
    expect(studentBSessions).toHaveLength(1);
    expect(studentBSessions[0].cohortId).toBe('cohort-cnd-2');
  });

  it('Property 5: Republished version supersedes previous version everywhere', () => {
    const dataset: SessionRecord[] = [
      // Version 1 (Archived)
      {
        id: 'sess-v1',
        academicPeriodId: 'period-1',
        versionNumber: 1,
        trainerId: trainerA.id,
        cohortId: 'cohort-dnd-1',
        unitCode: 'NUT101',
        unitName: 'Clinical Nutrition I (Old Time)',
        status: 'locked',
        timetableStatus: 'archived',
      },
      // Version 2 (Published / Active)
      {
        id: 'sess-v2',
        academicPeriodId: 'period-1',
        versionNumber: 2,
        trainerId: trainerA.id,
        cohortId: 'cohort-dnd-1',
        unitCode: 'NUT101',
        unitName: 'Clinical Nutrition I (Updated Time)',
        status: 'locked',
        timetableStatus: 'published',
      },
    ];

    const trainerSessions = getTrainerVisibleSessions(trainerA.id, dataset);
    expect(trainerSessions).toHaveLength(1);
    expect(trainerSessions[0].unitName).toBe('Clinical Nutrition I (Updated Time)');
    expect(trainerSessions[0].versionNumber).toBe(2);

    const studentSessions = getStudentVisibleSessions(studentCohortA, dataset);
    expect(studentSessions).toHaveLength(1);
    expect(studentSessions[0].unitName).toBe('Clinical Nutrition I (Updated Time)');
    expect(studentSessions[0].versionNumber).toBe(2);
  });
});
