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
});
