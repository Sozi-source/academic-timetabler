import { describe, expect, it } from 'vitest';
import type { TrainerMarkComponentKey, TrainerMarkComponentSubmissions, TrainerMarkEntryRow } from '@/features/assessment/trainer-mark-entry-types';

describe('trainer mark entry student deduplication and scope unification', () => {
  it('deduplicates students appearing in multiple equivalent assessment events and merges marks', () => {
    // Simulate allRosterRows from two equivalent assessment events (e.g. eventA and eventB)
    const allRosterRows = [
      { assessment_id: 'event-A', student_id: 'student-1', cohort_id: 'cohort-1', pre_assessment_status: 'expected' },
      { assessment_id: 'event-B', student_id: 'student-1', cohort_id: 'cohort-1', pre_assessment_status: 'expected' },
      { assessment_id: 'event-A', student_id: 'student-2', cohort_id: 'cohort-1', pre_assessment_status: 'expected' },
      { assessment_id: 'event-B', student_id: 'student-2', cohort_id: 'cohort-1', pre_assessment_status: 'expected' },
    ];

    const studentById = new Map([
      ['student-1', { id: 'student-1', admission_number: 'DHN/001', full_name: 'Alice Johnson' }],
      ['student-2', { id: 'student-2', admission_number: 'DHN/002', full_name: 'Bob Smith' }],
    ]);

    // Student 1 has marks stored under event-B; Student 2 has marks under event-A
    const drafts = [
      { assessment_id: 'event-B', student_id: 'student-1', assignment_mark: 4, presentation_mark: 8, rat_mark: 12, cat_mark: 13, exam_mark: 55 },
      { assessment_id: 'event-A', student_id: 'student-2', assignment_mark: 5, presentation_mark: 9, rat_mark: 14, cat_mark: 14, exam_mark: 62 },
    ];

    const draftByKey = new Map(drafts.map((d) => [`${d.assessment_id}:${d.student_id}`, d]));
    const draftByStudentId = new Map(drafts.map((d) => [d.student_id, d]));

    const cohorts = new Map<string, {
      id: string;
      name: string;
      students: TrainerMarkEntryRow[];
    }>();
    const seenStudentIdsByCohort = new Map<string, Set<string>>();

    for (const roster of allRosterRows) {
      const student = studentById.get(roster.student_id);
      if (!student) continue;

      const cohortKey = roster.cohort_id;
      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, {
          id: roster.cohort_id,
          name: 'DHN MAY 24',
          students: [],
        });
        seenStudentIdsByCohort.set(cohortKey, new Set());
      }
      const cohort = cohorts.get(cohortKey)!;
      const seenStudents = seenStudentIdsByCohort.get(cohortKey)!;
      const draft = draftByKey.get(`${roster.assessment_id}:${roster.student_id}`) ?? draftByStudentId.get(roster.student_id);

      if (seenStudents.has(roster.student_id)) {
        const existingStudent = cohort.students.find((s) => s.studentId === roster.student_id);
        if (existingStudent && draft) {
          existingStudent.assignment = existingStudent.assignment ?? draft.assignment_mark ?? null;
          existingStudent.presentation = existingStudent.presentation ?? draft.presentation_mark ?? null;
          existingStudent.rat = existingStudent.rat ?? draft.rat_mark ?? null;
          existingStudent.cat = existingStudent.cat ?? draft.cat_mark ?? null;
          if (existingStudent.attendanceStatus !== 'absent') {
            existingStudent.exam = existingStudent.exam ?? draft.exam_mark ?? null;
          }
        }
        continue;
      }
      seenStudents.add(roster.student_id);

      cohort.students.push({
        assessmentId: roster.assessment_id,
        studentId: roster.student_id,
        admissionNumber: student.admission_number,
        fullName: student.full_name,
        attendanceStatus: roster.pre_assessment_status === 'absent' ? 'absent' : 'expected',
        assignment: draft?.assignment_mark ?? null,
        presentation: draft?.presentation_mark ?? null,
        rat: draft?.rat_mark ?? null,
        cat: draft?.cat_mark ?? null,
        exam: roster.pre_assessment_status === 'absent' ? null : draft?.exam_mark ?? null,
      });
    }

    const cohort = cohorts.get('cohort-1')!;
    // Must contain exactly 2 unique students, not 4
    expect(cohort.students).toHaveLength(2);
    expect(cohort.students.map((s) => s.studentId)).toEqual(['student-1', 'student-2']);

    // Student 1 (whose draft was in event-B, but first row was event-A) must have backfilled marks
    const alice = cohort.students.find((s) => s.studentId === 'student-1');
    expect(alice?.assignment).toBe(4);
    expect(alice?.cat).toBe(13);
    expect(alice?.exam).toBe(55);

    // Student 2 has marks from event-A
    const bob = cohort.students.find((s) => s.studentId === 'student-2');
    expect(bob?.assignment).toBe(5);
    expect(bob?.cat).toBe(14);
    expect(bob?.exam).toBe(62);
  });

  it('unifies component submissions when at least one scope has submitted timestamp', () => {
    const scopeRows = [
      { assessment_id: 'event-A', cohort_id: 'cohort-1', submitted_at: null },
      { assessment_id: 'event-B', cohort_id: 'cohort-1', submitted_at: '2026-10-24T12:00:00Z' },
    ];

    const componentSubmissionByKey = new Map([
      ['event-A:cohort-1:cat', '2026-10-24T10:00:00Z'],
    ]);

    const componentSubmissions = Object.fromEntries((['assignment', 'presentation', 'rat', 'cat', 'exam'] as TrainerMarkComponentKey[]).flatMap((component) => {
      const timestamps = scopeRows
        .map((scope) => componentSubmissionByKey.get(`${scope.assessment_id}:${scope.cohort_id ?? 'all'}:${component}`))
        .filter((timestamp): timestamp is string => typeof timestamp === 'string');
      return timestamps.length > 0
        ? [[component, [...timestamps].sort().at(-1) as string]]
        : [];
    })) as TrainerMarkComponentSubmissions;

    const submittedAt = scopeRows.some((scope) => scope.submitted_at)
      ? [...scopeRows.map((scope) => scope.submitted_at)].filter(Boolean).sort().pop() ?? null
      : null;

    expect(componentSubmissions.cat).toBe('2026-10-24T10:00:00Z');
    expect(componentSubmissions.exam).toBeUndefined();
    expect(submittedAt).toBe('2026-10-24T12:00:00Z');
  });
});
