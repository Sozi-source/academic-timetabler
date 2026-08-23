import {
  CalendarDays,
  Clock3,
  MapPin,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { requireTrainerAccess } from '@/features/auth/authorization';
import {
  formatTimetableClock,
  mergeStaffTimetableSessions,
} from '@/features/staff-workspace/domain';
import { getStaffPublishedTimetable } from '@/features/staff-workspace/queries';
import type { StaffTimetableSession } from '@/features/staff-workspace/types';
import { cn } from '@/lib/utils/cn';

const WEEK_DAYS = [
  { key: 'monday', label: 'Monday', seq: 1 },
  { key: 'tuesday', label: 'Tuesday', seq: 2 },
  { key: 'wednesday', label: 'Wednesday', seq: 3 },
  { key: 'thursday', label: 'Thursday', seq: 4 },
  { key: 'friday', label: 'Friday', seq: 5 },
  { key: 'saturday', label: 'Saturday', seq: 6 },
] as const;

function prettyDay(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupByPeriod(sessions: StaffTimetableSession[]) {
  const periods = new Map<
    string,
    {
      name: string;
      sessions: StaffTimetableSession[];
    }
  >();

  for (const session of sessions) {
    const current = periods.get(session.academicPeriodId) ?? {
      name: session.academicPeriodName,
      sessions: [],
    };

    current.sessions.push(session);
    periods.set(session.academicPeriodId, current);
  }

  return [...periods.entries()];
}

function groupByDay(sessions: StaffTimetableSession[]) {
  const days = new Map<string, StaffTimetableSession[]>();

  for (const session of sessions) {
    const key = `${session.daySequence}:${session.dayName}`;
    const current = days.get(key) ?? [];
    current.push(session);
    days.set(key, current);
  }

  return [...days.entries()];
}

export default async function StaffTimetablePage() {
  const profile = await requireTrainerAccess();
  const rawTimetable = await getStaffPublishedTimetable(profile.id);
  const mergedSessions = mergeStaffTimetableSessions(rawTimetable.sessions);
  const periods = groupByPeriod(mergedSessions);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Staff"
        title="My Timetable"
        description="Your published teaching schedule."
        icon={CalendarDays}
      />

      {periods.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white px-5 py-10 text-center">
          <CalendarDays className="mx-auto size-6 text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-slate-900">No published timetable</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Your schedule will appear here after the department publishes the teaching allocations.
          </p>
        </section>
      ) : (
        periods.map(([periodId, period]) => {
          // Extract active days that have sessions
          const activeDaySeqs = new Set(period.sessions.map((s) => s.daySequence));
          const visibleDays = WEEK_DAYS.filter(
            (d) => activeDaySeqs.has(d.seq) || d.seq <= 5
          );

          // Extract distinct sorted time slots
          const timeSlotMap = new Map<string, { startsAt: string; endsAt: string; startSeq: number }>();
          for (const s of period.sessions) {
            const key = `${s.startsAt}-${s.endsAt}`;
            if (!timeSlotMap.has(key)) {
              timeSlotMap.set(key, {
                startsAt: s.startsAt,
                endsAt: s.endsAt,
                startSeq: s.startSequence,
              });
            }
          }

          const sortedTimeSlots = [...timeSlotMap.values()].sort((a, b) => {
            if (a.startSeq !== b.startSeq) return a.startSeq - b.startSeq;
            return a.startsAt.localeCompare(b.startsAt);
          });

          return (
            <div key={periodId} className="space-y-5">
              {/* Period Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{period.name}</h2>
                  <p className="text-xs text-slate-500">
                    {period.sessions.length} weekly classes · {activeDaySeqs.size} teaching days
                  </p>
                </div>
                <span className="rounded bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 border border-teal-200">
                  Published Schedule
                </span>
              </div>

              {/* 1. DESKTOP WEEKLY TABLE (Visible on Desktop / Tablets) */}
              <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                      <th className="w-32 px-3 py-2.5 border-r border-slate-800 text-center">
                        Time
                      </th>
                      {visibleDays.map((day) => (
                        <th
                          key={day.key}
                          className="px-3 py-2.5 border-r border-slate-800 text-left last:border-r-0"
                        >
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {sortedTimeSlots.map((slot, sIdx) => (
                      <tr
                        key={`${slot.startsAt}-${slot.endsAt}`}
                        className={sIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}
                      >
                        {/* Time Column */}
                        <td className="border-r border-slate-200 px-2.5 py-2.5 text-center bg-slate-50/80 align-top">
                          <span className="font-bold text-slate-900 text-xs block">
                            {formatTimetableClock(slot.startsAt)}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            to {formatTimetableClock(slot.endsAt)}
                          </span>
                        </td>

                        {/* Day Cells */}
                        {visibleDays.map((day) => {
                          const matchingSessions = period.sessions.filter(
                            (s) =>
                              (s.dayName.toLowerCase() === day.key ||
                                s.daySequence === day.seq) &&
                              s.startsAt === slot.startsAt
                          );

                          return (
                            <td
                              key={day.key}
                              className="border-r border-slate-200 px-2 py-2 align-top last:border-r-0"
                            >
                              {matchingSessions.length > 0 ? (
                                <div className="space-y-1.5">
                                  {matchingSessions.map((session) => (
                                    <div
                                      key={session.id}
                                      className="rounded border border-slate-200 bg-white p-2 text-xs hover:border-slate-300 transition"
                                    >
                                      <p className="font-bold text-slate-900 leading-snug">
                                        {session.unitName}
                                      </p>
                                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
                                        <span className="flex items-center gap-1 font-medium">
                                          <MapPin className="size-3 text-slate-400" />
                                          {session.roomLabel}
                                        </span>
                                        <span className="capitalize text-[10px] text-slate-500">
                                          {session.deliveryMode}
                                        </span>
                                      </div>
                                      {session.cohortNames.length > 0 && (
                                        <p className="mt-0.5 text-[10px] text-slate-500 truncate" title={session.cohortNames.join(', ')}>
                                          {session.cohortNames.join(' · ')}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-300 block text-center py-2">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 2. MOBILE DAY-BY-DAY SCHEDULE TABLE (Optimized for Small Screens) */}
              <div className="block md:hidden space-y-4">
                {groupByDay(period.sessions).map(([dayKey, sessions]) => (
                  <div
                    key={dayKey}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs"
                  >
                    <div className="border-b border-slate-200 bg-slate-100/70 px-3.5 py-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {prettyDay(sessions[0].dayName)}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {sessions.length} {sessions.length === 1 ? 'class' : 'classes'}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {sessions.map((session) => (
                        <div key={session.id} className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 font-bold text-teal-800">
                              <Clock3 className="size-3 text-teal-700" />
                              {formatTimetableClock(session.startsAt)} – {formatTimetableClock(session.endsAt)}
                            </span>
                            <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {session.deliveryMode}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-900 leading-snug">
                            {session.unitName}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3 text-slate-400" />
                              {session.roomLabel}
                            </span>
                            {session.cohortNames.length > 0 && (
                              <span className="flex items-center gap-1 text-slate-500 truncate max-w-[160px]">
                                <Users className="size-3 text-slate-400" />
                                {session.cohortNames.join(' · ')}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
