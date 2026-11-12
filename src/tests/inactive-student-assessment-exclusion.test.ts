import { describe, expect, it } from 'vitest';

interface StudentRecord {
  id: string;
  admissionNumber: string;
  fullName: string;
  cohortId: string;
  lifecycleStatus: 'admitted' | 'active' | 'deferred' | 'dropped_out' | 'suspended' | 'withdrawn';
  academicPhase: 'in_class' | 'attachment' | 'internship' | 'deferred';
}

interface AssessmentRosterEntry {
  assessmentId: string;
  studentId: string;
  cohortId: string;
  preAssessmentStatus: 'expected' | 'absent';
}

interface ComponentSubmissionEntry {
  student_id: string;
  cat?: number | null;
  cat_absent?: boolean;
}

/**
 * Pure simulation of the database cohort completeness check in save_assessment_online_component_marks:
 *
 * Ensures that only active classroom students (lifecycle_status IN ('admitted', 'active')
 * AND academic_phase = 'in_class') are required when evaluating whether every student
 * in a cohort is included in the submission payload.
 */
function validateCohortCompleteness({
  assessmentId,
  targetEntries,
  roster,
  students,
}: {
  assessmentId: string;
  targetEntries: ComponentSubmissionEntry[];
  roster: AssessmentRosterEntry[];
  students: StudentRecord[];
}): { success: boolean; error?: string } {
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const submittedStudentIds = new Set(targetEntries.map((e) => e.student_id));

  // Determine which cohorts have at least one student in the submission payload
  const submittedCohortIds = new Set<string>();
  for (const r of roster) {
    if (r.assessmentId === assessmentId && submittedStudentIds.has(r.studentId)) {
      submittedCohortIds.add(r.cohortId);
    }
  }

  // Check if any ACTIVE student in those cohorts is missing from the submission payload
  for (const r of roster) {
    if (r.assessmentId !== assessmentId) continue;
    if (!submittedCohortIds.has(r.cohortId)) continue;

    const student = studentMap.get(r.studentId);
    if (!student) continue;

    // Hardened Domain Rule: Only active classroom candidates are required
    const isActive =
      ['admitted', 'active'].includes(student.lifecycleStatus) &&
      student.academicPhase === 'in_class';

    if (isActive && !submittedStudentIds.has(r.studentId)) {
      return {
        success: false,
        error: 'Include every student in a cohort before submitting its component.',
      };
    }
  }

  return { success: true };
}

describe('Inactive Student Exclusion from Cohort Completeness Validation', () => {
  const assessmentId = 'event-diet-therapy-1';
  const cndCohortId = 'cohort-cnd-may-26';
  const dndCohortId = 'cohort-dnd-may-26';

  const mockStudents: StudentRecord[] = [
    // 13 active CND students
    ...Array.from({ length: 13 }, (_, i) => ({
      id: `cnd-active-${i + 1}`,
      admissionNumber: `CND/M-${7500 + i}/IC/26`,
      fullName: `Active CND Student ${i + 1}`,
      cohortId: cndCohortId,
      lifecycleStatus: 'active' as const,
      academicPhase: 'in_class' as const,
    })),
    // 1 dropped out CND student (e.g. Claire Wakonyo)
    {
      id: 'cnd-dropped-out-1',
      admissionNumber: 'CND/M-7922/IC/26',
      fullName: 'Mwangi, Claire Wakonyo',
      cohortId: cndCohortId,
      lifecycleStatus: 'dropped_out' as const,
      academicPhase: 'in_class' as const,
    },
    // 7 active DND students
    ...Array.from({ length: 7 }, (_, i) => ({
      id: `dnd-active-${i + 1}`,
      admissionNumber: `DND/M-${7580 + i}/IC/26`,
      fullName: `Active DND Student ${i + 1}`,
      cohortId: dndCohortId,
      lifecycleStatus: 'active' as const,
      academicPhase: 'in_class' as const,
    })),
  ];

  const mockRoster: AssessmentRosterEntry[] = mockStudents.map((s) => ({
    assessmentId,
    studentId: s.id,
    cohortId: s.cohortId,
    preAssessmentStatus: 'expected',
  }));

  it('allows submission when all active candidates in a cohort are submitted, ignoring dropped-out candidates', () => {
    // Submitting 13 active CND students (omitting the dropped-out student)
    const targetEntries: ComponentSubmissionEntry[] = mockStudents
      .filter((s) => s.cohortId === cndCohortId && s.lifecycleStatus === 'active')
      .map((s) => ({
        student_id: s.id,
        cat: 12,
      }));

    expect(targetEntries).toHaveLength(13);

    const result = validateCohortCompleteness({
      assessmentId,
      targetEntries,
      roster: mockRoster,
      students: mockStudents,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects submission if an active candidate in the cohort is missing', () => {
    // Submitting only 12 of the 13 active CND students
    const targetEntries: ComponentSubmissionEntry[] = mockStudents
      .filter((s) => s.cohortId === cndCohortId && s.lifecycleStatus === 'active')
      .slice(0, 12)
      .map((s) => ({
        student_id: s.id,
        cat: 12,
      }));

    expect(targetEntries).toHaveLength(12);

    const result = validateCohortCompleteness({
      assessmentId,
      targetEntries,
      roster: mockRoster,
      students: mockStudents,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Include every student in a cohort before submitting its component.');
  });

  it('allows multi-cohort shared class submission where all active students are accounted for', () => {
    // Submitting all 13 active CND students + all 7 active DND students = 20 active candidates
    const targetEntries: ComponentSubmissionEntry[] = mockStudents
      .filter((s) => s.lifecycleStatus === 'active')
      .map((s) => ({
        student_id: s.id,
        cat: 10,
      }));

    expect(targetEntries).toHaveLength(20);

    const result = validateCohortCompleteness({
      assessmentId,
      targetEntries,
      roster: mockRoster,
      students: mockStudents,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('ignores deferred, suspended, and attachment candidates from required submission set', () => {
    const studentsWithVariousInactive: StudentRecord[] = [
      ...mockStudents,
      {
        id: 'cnd-deferred-1',
        admissionNumber: 'CND/M-7999/IC/26',
        fullName: 'Deferred Student',
        cohortId: cndCohortId,
        lifecycleStatus: 'deferred',
        academicPhase: 'deferred',
      },
      {
        id: 'cnd-attachment-1',
        admissionNumber: 'CND/M-8000/IC/26',
        fullName: 'Attachment Student',
        cohortId: cndCohortId,
        lifecycleStatus: 'active',
        academicPhase: 'attachment',
      },
    ];

    const expandedRoster: AssessmentRosterEntry[] = studentsWithVariousInactive.map((s) => ({
      assessmentId,
      studentId: s.id,
      cohortId: s.cohortId,
      preAssessmentStatus: 'expected',
    }));

    // Submitting only the 13 active, in_class CND candidates
    const targetEntries: ComponentSubmissionEntry[] = mockStudents
      .filter((s) => s.cohortId === cndCohortId && s.lifecycleStatus === 'active')
      .map((s) => ({
        student_id: s.id,
        cat: 14,
      }));

    const result = validateCohortCompleteness({
      assessmentId,
      targetEntries,
      roster: expandedRoster,
      students: studentsWithVariousInactive,
    });

    expect(result.success).toBe(true);
  });
});
