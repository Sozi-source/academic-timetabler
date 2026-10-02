import { describe, expect, it } from 'vitest';

describe('attendance session date matching', () => {
  it('must never reuse a historical class session for a different requested date', () => {
    const scheduledSessionId = 'scheduled-1';
    const requestedDate = '2026-09-22';
    const sessions = [
      { id: 'old', scheduled_session_id: scheduledSessionId, session_date: '2026-09-15', status: 'completed' },
      { id: 'today', scheduled_session_id: scheduledSessionId, session_date: requestedDate, status: 'open' },
    ];

    const match = sessions.find(
      (session) =>
        session.scheduled_session_id === scheduledSessionId &&
        session.session_date === requestedDate &&
        session.status !== 'cancelled',
    );

    expect(match?.id).toBe('today');
    expect(match?.session_date).toBe(requestedDate);
  });

  it('must return null/undefined when searching for a date with no existing session, even if past sessions exist for scheduled_session_id', () => {
    const scheduledSessionId = '3c92d1ac-a41f-48f5-b391-8e19aab28311';
    const targetDate = '2026-10-02';
    const pastSessions = [
      { id: '5181121f-6bed-4105-a623-9a19b2e61a92', scheduled_session_id: scheduledSessionId, session_date: '2026-09-25', status: 'completed' },
    ];

    const match = pastSessions.find(
      (session) =>
        session.scheduled_session_id === scheduledSessionId &&
        session.session_date === targetDate &&
        session.status !== 'cancelled',
    );

    expect(match).toBeUndefined();
  });
});
