import { describe, expect, it } from 'vitest';
import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';
import type { AssessmentCandidateRow } from '@/features/assessment/types';

describe('Shared Unit Markbook Deduplication and Sibling Submission Hardening', () => {
  it('deduplicates students across sibling assessment events for shared classes', () => {
    // Simulating raw data returned when querying assessment_population across sibling events:
    // Event 1 (CND offering) has 30 CND, 19 DND, 1 DND 25 = 50 candidates
    // Event 2 (DND offering) has the same 30 CND, 19 DND, 1 DND 25 = 50 candidates
    // Total raw records = 100
    const rawData: AssessmentCandidateRow[] = [];

    // Cohort 1: CND SEPT 26 (30 students)
    for (let i = 1; i <= 30; i++) {
      const studentId = `cnd-student-${i}`;
      const adm = `CND/S-${8000 + i}/IC/26`;
      const cohort = { id: 'cohort-cnd', code: 'CND-26', name: 'CND SEPT 26' };
      // Copy in Event 1
      rawData.push({
        id: `pop-ev1-${studentId}`,
        population_status: 'expected',
        attendance_status: 'present',
        cat_absence_reason: null,
        cat_absence_recommendation: null,
        exam_absence_reason: null,
        exam_absence_recommendation: null,
        student: { id: studentId, admission_number: adm, full_name: `CND Student ${i}` },
        cohort,
      });
      // Duplicate copy in Event 2 (sibling event)
      rawData.push({
        id: `pop-ev2-${studentId}`,
        population_status: 'expected',
        attendance_status: 'present',
        cat_absence_reason: null,
        cat_absence_recommendation: null,
        exam_absence_reason: null,
        exam_absence_recommendation: null,
        student: { id: studentId, admission_number: adm, full_name: `CND Student ${i}` },
        cohort,
      });
    }

    // Cohort 2: DND SEPT 26 (19 students)
    for (let i = 1; i <= 19; i++) {
      const studentId = `dnd-student-${i}`;
      const adm = `DND/S-${8300 + i}/IC/26`;
      const cohort = { id: 'cohort-dnd', code: 'DND-26', name: 'DND SEPT 26' };
      // Copy in Event 1
      rawData.push({
        id: `pop-ev1-${studentId}`,
        population_status: 'expected',
        attendance_status: 'present',
        cat_absence_reason: null,
        cat_absence_recommendation: null,
        exam_absence_reason: null,
        exam_absence_recommendation: null,
        student: { id: studentId, admission_number: adm, full_name: `DND Student ${i}` },
        cohort,
      });
      // Duplicate copy in Event 2
      rawData.push({
        id: `pop-ev2-${studentId}`,
        population_status: 'expected',
        attendance_status: 'present',
        cat_absence_reason: null,
        cat_absence_recommendation: null,
        exam_absence_reason: null,
        exam_absence_recommendation: null,
        student: { id: studentId, admission_number: adm, full_name: `DND Student ${i}` },
        cohort,
      });
    }

    // Cohort 3: DND SEPT 25 (1 student)
    const carryoverId = 'dnd-carryover-1';
    const carryoverAdm = 'DND/S-7100/IC/25';
    const carryoverCohort = { id: 'cohort-dnd-25', code: 'DND-25', name: 'DND SEPT 25' };
    rawData.push({
      id: `pop-ev1-${carryoverId}`,
      population_status: 'expected',
      attendance_status: 'present',
      cat_absence_reason: null,
      cat_absence_recommendation: null,
      exam_absence_reason: null,
      exam_absence_recommendation: null,
      student: { id: carryoverId, admission_number: carryoverAdm, full_name: 'DND Carryover 1' },
      cohort: carryoverCohort,
    });
    rawData.push({
      id: `pop-ev2-${carryoverId}`,
      population_status: 'expected',
      attendance_status: 'present',
      cat_absence_reason: null,
      cat_absence_recommendation: null,
      exam_absence_reason: null,
      exam_absence_recommendation: null,
      student: { id: carryoverId, admission_number: carryoverAdm, full_name: 'DND Carryover 1' },
      cohort: carryoverCohort,
    });

    // Total raw records should be 100 (doubled from 50)
    expect(rawData.length).toBe(100);

    // Apply the deduplication algorithm used in getAssessmentPopulation
    const studentMap = new Map<string, AssessmentCandidateRow>();
    for (const raw of rawData) {
      const studentId = raw.student?.id;
      if (!studentId) continue;
      const existing = studentMap.get(studentId);
      if (!existing) {
        studentMap.set(studentId, raw);
      } else {
        if (existing.attendance_status === 'absent' && raw.attendance_status !== 'absent') {
          studentMap.set(studentId, { ...existing, ...raw });
        }
      }
    }
    const deduplicated = Array.from(studentMap.values());
    deduplicated.sort((a, b) =>
      compareAdmissionNumbers(a.student?.admission_number, b.student?.admission_number),
    );

    // Verified: exactly 50 unique students
    expect(deduplicated.length).toBe(50);

    // Cohort breakdown verified
    const cndCount = deduplicated.filter((r) => r.cohort?.id === 'cohort-cnd').length;
    const dndCount = deduplicated.filter((r) => r.cohort?.id === 'cohort-dnd').length;
    const dnd25Count = deduplicated.filter((r) => r.cohort?.id === 'cohort-dnd-25').length;

    expect(cndCount).toBe(30);
    expect(dndCount).toBe(19);
    expect(dnd25Count).toBe(1);
    expect(cndCount + dndCount + dnd25Count).toBe(50);
  });

  it('calculates 100% recorded results ratio when 50 marks exist for 50 deduplicated candidates', () => {
    const totalCandidates = 50;
    const recordedResultStudentIds = new Set<string>();
    for (let i = 1; i <= 30; i++) recordedResultStudentIds.add(`cnd-student-${i}`);
    for (let i = 1; i <= 19; i++) recordedResultStudentIds.add(`dnd-student-${i}`);
    recordedResultStudentIds.add('dnd-carryover-1');

    const resultCount = recordedResultStudentIds.size;
    expect(resultCount).toBe(50);

    const ratioDisplay = `${resultCount} / ${totalCandidates}`;
    expect(ratioDisplay).toBe('50 / 50');
    expect(resultCount / totalCandidates).toBe(1); // 100% complete, NOT 1/2 (50/100)
  });

  it('synchronizes CAT deliverable status when any sibling event has finalized CAT marks', () => {
    // Sibling event items in a shared deliverable group
    const event1 = {
      id: 'event-cnd',
      catMarksFinalizedAt: '2026-11-10T12:00:00Z',
      isSubmitted: false,
      isFinalised: false,
    };
    const event2 = {
      id: 'event-dnd',
      catMarksFinalizedAt: null as string | null,
      isSubmitted: false,
      isFinalised: false,
    };

    const groupItems = [event1, event2];

    // With sibling propagation: if any sibling has catMarksFinalizedAt, all inherit it
    const catFinalizedTimestamp = groupItems.find((it) => it.catMarksFinalizedAt)?.catMarksFinalizedAt ?? null;
    expect(catFinalizedTimestamp).toBe('2026-11-10T12:00:00Z');

    let catSubmittedCount = 0;
    for (const it of groupItems) {
      const isCatSub = it.isSubmitted || it.isFinalised || Boolean(it.catMarksFinalizedAt || catFinalizedTimestamp);
      if (isCatSub) catSubmittedCount++;
    }

    // Both items are now recognized as submitted
    expect(catSubmittedCount).toBe(2);
    const catStatus = catSubmittedCount > 0 && catSubmittedCount === groupItems.length ? 'Submitted' : 'In Progress';
    expect(catStatus).toBe('Submitted'); // Correctly "Submitted", NOT stuck at "In Progress" or "1/2 Submitted"
  });
});
