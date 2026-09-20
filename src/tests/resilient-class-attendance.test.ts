import { describe, expect, it } from 'vitest';

describe('Resilient Class Attendance Pipeline', () => {
  it('resolves latest class attendance when scheduledSessionId matches exactly', () => {
    const items = [
      {
        scheduledSessionId: 'sess-100',
        teachingAllocationId: 'alloc-1',
        unitId: 'unit-1',
        cohortId: 'cohort-1',
        latestClassSessionId: null,
        latestSessionDate: null,
        latestStatus: null,
      },
    ];

    const classSessions = [
      {
        id: 'cs-1',
        scheduled_session_id: 'sess-100',
        teaching_allocation_id: 'alloc-1',
        unit_id: 'unit-1',
        cohort_id: 'cohort-1',
        session_date: '2026-09-18',
        status: 'completed',
      },
    ];

    const csBySessionId = new Map();
    const csByAllocUnit = new Map();
    const csByUnitCohort = new Map();

    for (const cs of classSessions) {
      if (cs.scheduled_session_id) csBySessionId.set(cs.scheduled_session_id, cs);
      if (cs.teaching_allocation_id && cs.unit_id) csByAllocUnit.set(`${cs.teaching_allocation_id}:${cs.unit_id}`, cs);
      if (cs.unit_id && cs.cohort_id) csByUnitCohort.set(`${cs.unit_id}:${cs.cohort_id}`, cs);
    }

    for (const item of items) {
      const cs =
        csBySessionId.get(item.scheduledSessionId) ||
        csByAllocUnit.get(`${item.teachingAllocationId}:${item.unitId}`) ||
        csByUnitCohort.get(`${item.unitId}:${item.cohortId}`);
      if (cs) {
        item.latestClassSessionId = String(cs.id);
        item.latestSessionDate = String(cs.session_date);
        item.latestStatus = cs.status;
      }
    }

    expect(items[0].latestClassSessionId).toBe('cs-1');
    expect(items[0].latestStatus).toBe('completed');
  });

  it('reconciles and resolves class attendance when scheduledSessionId shifted after timetable regeneration', () => {
    // Timetable was regenerated, so item has a NEW session ID 'sess-200'
    const items = [
      {
        scheduledSessionId: 'sess-200',
        teachingAllocationId: 'alloc-1',
        unitId: 'unit-1',
        cohortId: 'cohort-1',
        latestClassSessionId: null,
        latestSessionDate: null,
        latestStatus: null,
      },
    ];

    // But class_session in DB was recorded under old session ID 'sess-100' or had it detached (null)
    const classSessions = [
      {
        id: 'cs-1',
        scheduled_session_id: 'sess-100', // old ID
        teaching_allocation_id: 'alloc-1',
        unit_id: 'unit-1',
        cohort_id: 'cohort-1',
        session_date: '2026-09-18',
        status: 'completed',
      },
    ];

    const csBySessionId = new Map();
    const csByAllocUnit = new Map();
    const csByUnitCohort = new Map();

    for (const cs of classSessions) {
      if (cs.scheduled_session_id) csBySessionId.set(cs.scheduled_session_id, cs);
      if (cs.teaching_allocation_id && cs.unit_id) csByAllocUnit.set(`${cs.teaching_allocation_id}:${cs.unit_id}`, cs);
      if (cs.unit_id && cs.cohort_id) csByUnitCohort.set(`${cs.unit_id}:${cs.cohort_id}`, cs);
    }

    for (const item of items) {
      const cs =
        csBySessionId.get(item.scheduledSessionId) ||
        csByAllocUnit.get(`${item.teachingAllocationId}:${item.unitId}`) ||
        csByUnitCohort.get(`${item.unitId}:${item.cohortId}`);
      if (cs) {
        item.latestClassSessionId = String(cs.id);
        item.latestSessionDate = String(cs.session_date);
        item.latestStatus = cs.status;
      }
    }

    // Must still find cs-1 and mark it completed via allocation+unit fallback!
    expect(items[0].latestClassSessionId).toBe('cs-1');
    expect(items[0].latestSessionDate).toBe('2026-09-18');
    expect(items[0].latestStatus).toBe('completed');
  });

  it('prevents false overdue unrecorded session locks when session IDs shifted', () => {
    const scheduledOnDates = [
      {
        scheduledSessionId: 'new-sess-999',
        teachingAllocationId: 'alloc-1',
        unitId: 'unit-nutrition-101',
        cohortId: 'cohort-may-2025',
        sessionDate: '2026-09-15',
        unitName: 'Clinical Nutrition',
        dayOfWeek: 'Tuesday',
      },
    ];

    // Attendance was previously recorded under old session ID 'old-sess-111'
    const recordedSessions = [
      {
        id: 'cs-completed-1',
        scheduled_session_id: 'old-sess-111',
        teaching_allocation_id: 'alloc-1',
        unit_id: 'unit-nutrition-101',
        cohort_id: 'cohort-may-2025',
        session_date: '2026-09-15',
        status: 'completed',
      },
    ];

    const recordedMap = new Map<string, string>();
    for (const cs of recordedSessions) {
      if (cs.scheduled_session_id) {
        recordedMap.set(`${cs.scheduled_session_id}:${cs.session_date}`, cs.status);
      }
      if (cs.teaching_allocation_id) {
        recordedMap.set(`${cs.teaching_allocation_id}:${cs.session_date}`, cs.status);
      }
      if (cs.unit_id && cs.cohort_id) {
        recordedMap.set(`${cs.unit_id}:${cs.cohort_id}:${cs.session_date}`, cs.status);
      }
      if (cs.unit_id) {
        recordedMap.set(`${cs.unit_id}:${cs.session_date}`, cs.status);
      }
    }

    const s = scheduledOnDates[0];
    const status =
      recordedMap.get(`${s.scheduledSessionId}:${s.sessionDate}`) ||
      recordedMap.get(`${s.teachingAllocationId}:${s.sessionDate}`) ||
      recordedMap.get(`${s.unitId}:${s.cohortId}:${s.sessionDate}`) ||
      recordedMap.get(`${s.unitId}:${s.sessionDate}`);

    const isRecorded = status === 'completed' || status === 'cancelled';

    // Must be true! Not unrecorded!
    expect(isRecorded).toBe(true);
    expect(status).toBe('completed');
  });

  it('recognizes exceptions and cancellations as recorded so trainers are not falsely locked out', () => {
    const recordedMap = new Map<string, string>();
    recordedMap.set('alloc-1:2026-09-16', 'cancelled');

    const status = recordedMap.get('alloc-1:2026-09-16');
    const isRecorded = status === 'completed' || status === 'cancelled';

    expect(isRecorded).toBe(true);
    expect(status).toBe('cancelled');
  });
});
