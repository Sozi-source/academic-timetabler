import type {
  GeneratorPreview,
} from './server-types';

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function GeneratorMasterGrid({ preview }: { preview: GeneratorPreview }) {
  const days = [...preview.workingDays].sort(
    (first, second) => first.sequenceNumber - second.sequenceNumber,
  );
  const slots = [...preview.teachingSlots].sort(
    (first, second) => first.sequenceNumber - second.sequenceNumber,
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-xs">
        <thead>
          <tr className="bg-surface-subtle">
            <th className="w-32 border-b border-r border-border px-3 py-3 font-semibold text-text-muted">Period</th>
            {days.map((day) => (
              <th key={day.id} className="border-b border-r border-border px-3 py-3 text-center font-semibold text-text-primary last:border-r-0">
                {titleCase(day.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.id} className="align-top">
              <th className="border-b border-r border-border bg-surface-subtle px-3 py-3 font-medium text-text-secondary">
                <span className="block font-semibold text-text-primary">{slot.code}</span>
                <span className="mt-0.5 block text-text-muted">
                  {slot.startsAt.slice(0, 5)}–{slot.endsAt.slice(0, 5)}
                </span>
              </th>
              {days.map((day) => {
                const sessions = preview.sessions.filter(
                  (session) =>
                    session.workingDayId === day.id &&
                    session.startTimeSlotId === slot.id,
                );

                return (
                  <td key={day.id} className="h-28 border-b border-r border-border p-2 last:border-r-0">
                    {sessions.length === 0 ? (
                      <span className="text-text-subtle">Available</span>
                    ) : (
                      <div className="space-y-2">
                        {sessions.map((session) => (
                          <article key={session.id} className="rounded-lg border border-primary-soft bg-primary-subtle p-2 leading-4">
                            <p className="font-semibold text-text-primary">{session.unitName}</p>
                            <p className="text-text-secondary">
                              {session.participantCohortCodes.join(' + ')}
                              {session.participantCohortCount > session.participantCohortCodes.length
                                ? ` +${session.participantCohortCount - session.participantCohortCodes.length} more`
                                : ''}
                            </p>
                            <p className="truncate text-text-muted">{session.trainerName}</p>
                            <p className="text-text-muted">
                              {session.roomCode ?? 'No room'} · {session.startsAt.slice(0, 5)}–{session.endsAt.slice(0, 5)}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
