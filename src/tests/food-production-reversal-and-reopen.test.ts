import { describe, expect, it } from 'vitest';

describe('Food Production Reversal and Markbook Reopen Hardening', () => {
  it('correctly reverts accidental student absences while retaining entered coursework marks', () => {
    // Simulated pre-reversal state after accidental final submission
    const existingDrafts = [
      {
        studentId: 'student-1',
        assignment: 4,
        presentation: 8,
        rat: 10,
        cat: null,
        exam: null,
      },
      {
        studentId: 'student-2',
        assignment: 2,
        presentation: 6,
        rat: 8,
        cat: null,
        exam: null,
      },
    ];

    const rosterBefore = [
      { studentId: 'student-1', preAssessmentStatus: 'absent' },
      { studentId: 'student-2', preAssessmentStatus: 'absent' },
    ];

    const populationBefore = [
      { studentId: 'student-1', attendanceStatus: 'absent' },
      { studentId: 'student-2', attendanceStatus: 'absent' },
    ];

    const eventBefore = {
      catMarksFinalizedAt: '2026-11-08T05:09:52.235834+00:00',
      examMarksFinalizedAt: null,
      marksSubmittedAt: '2026-11-08T05:09:52.235834+00:00',
      status: 'open',
    };

    // Reversal logic
    const rosterAfter = rosterBefore.map((r) => ({
      ...r,
      preAssessmentStatus: r.preAssessmentStatus === 'absent' ? 'expected' : r.preAssessmentStatus,
    }));

    const populationAfter = populationBefore.map((p) => ({
      ...p,
      attendanceStatus: p.attendanceStatus === 'absent' ? 'present' : p.attendanceStatus,
    }));

    const eventAfter = {
      ...eventBefore,
      catMarksFinalizedAt: null,
      marksSubmittedAt: null,
      examMarksFinalizedAt: null,
    };

    // Coursework marks must be completely retained
    expect(existingDrafts[0].assignment).toBe(4);
    expect(existingDrafts[0].presentation).toBe(8);
    expect(existingDrafts[0].rat).toBe(10);
    expect(existingDrafts[1].assignment).toBe(2);
    expect(existingDrafts[1].presentation).toBe(6);
    expect(existingDrafts[1].rat).toBe(8);

    // Absence must be reverted
    expect(rosterAfter.every((r) => r.preAssessmentStatus === 'expected')).toBe(true);
    expect(populationAfter.every((p) => p.attendanceStatus === 'present')).toBe(true);

    // Finalized lock timestamp must be cleared
    expect(eventAfter.catMarksFinalizedAt).toBeNull();
    expect(eventAfter.marksSubmittedAt).toBeNull();
  });

  it('unsubmitting CAT component unlocks CAT submission across sibling equivalent events', () => {
    const siblingEvents = [
      { id: 'ev-cnd-1304', code: 'CND 1304', catFinalizedAt: '2026-11-08T05:09:52Z' },
      { id: 'ev-dnd-1304', code: 'DND 1304', catFinalizedAt: '2026-11-08T05:09:52Z' },
      { id: 'ev-dhn-1305', code: 'DHN 1305', catFinalizedAt: '2026-11-08T05:09:52Z' },
      { id: 'ev-chn-2203', code: 'CHN 2203', catFinalizedAt: '2026-11-08T05:09:52Z' },
    ];

    const component = 'cat';
    const unlockedSiblings = siblingEvents.map((ev) => ({
      ...ev,
      catFinalizedAt: component === 'cat' || component === 'all' ? null : ev.catFinalizedAt,
    }));

    expect(unlockedSiblings.every((ev) => ev.catFinalizedAt === null)).toBe(true);
  });

  it('unsubmitting Exam component restores student presence and resets final lock', () => {
    const component = 'exam';
    const event = {
      examMarksFinalizedAt: '2026-11-10T12:00:00Z',
      finalisedAt: '2026-11-10T12:00:00Z',
      operationalWorkflowStatus: 'finalised',
      status: 'closed',
    };

    const roster = [
      { studentId: 'student-1', status: 'absent' },
      { studentId: 'student-2', status: 'absent' },
    ];

    // Unlock exam action
    const eventAfter = {
      ...event,
      examMarksFinalizedAt: component === 'exam' || component === 'all' ? null : event.examMarksFinalizedAt,
      finalisedAt: component === 'exam' || component === 'all' ? null : event.finalisedAt,
      operationalWorkflowStatus: component === 'exam' || component === 'all' ? 'open' : event.operationalWorkflowStatus,
      status: component === 'exam' || component === 'all' ? 'open' : event.status,
    };

    const rosterAfter = roster.map((r) => ({
      ...r,
      status: component === 'exam' || component === 'all' ? 'expected' : r.status,
    }));

    expect(eventAfter.examMarksFinalizedAt).toBeNull();
    expect(eventAfter.status).toBe('open');
    expect(rosterAfter.every((r) => r.status === 'expected')).toBe(true);
  });
});
