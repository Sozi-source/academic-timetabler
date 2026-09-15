'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Filter,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import {
  attendanceRateLabel,
  COLLEGE_MINIMUM_ATTENDANCE_PERCENT,
  getAttendanceBadgeVariant,
  getAttendanceStanding,
} from '@/features/attendance-analytics/domain';
import type { StudentPortalAttendanceSnapshot } from '@/features/attendance-analytics/types';
import { formatPortalClock } from './domain';

interface StudentAttendanceViewProps {
  attendance: StudentPortalAttendanceSnapshot;
}

export function StudentAttendanceView({
  attendance,
}: StudentAttendanceViewProps) {
  const [sessionFilter, setSessionFilter] = useState<'all' | 'missed'>('all');

  const missedSessions = useMemo(() => {
    return attendance.sessions.filter((s) => s.status === 'absent');
  }, [attendance.sessions]);

  const displayedSessions = sessionFilter === 'missed' ? missedSessions : attendance.sessions;

  const standing = getAttendanceStanding(attendance.attendanceRate);
  const isBelowMinimum = standing === 'at_risk';

  return (
    <div className="space-y-4">
      {/* Policy Banner */}
      {isBelowMinimum ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-900 shadow-2xs">
          <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-rose-600" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-rose-950">Attendance Debarment Risk</p>
              <span className="rounded bg-rose-200/80 px-1.5 py-0.2 text-[10px] font-bold text-rose-900">
                Below {COLLEGE_MINIMUM_ATTENDANCE_PERCENT}% Minimum
              </span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-rose-800">
              Your overall attendance is <strong>{attendanceRateLabel(attendance.attendanceRate)}</strong>. The college requires a minimum of <strong>{COLLEGE_MINIMUM_ATTENDANCE_PERCENT}%</strong> attendance across completed sessions for examination clearance.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              Good Standing: Meets the college minimum requirement of {COLLEGE_MINIMUM_ATTENDANCE_PERCENT}% attendance.
            </span>
          </div>
          <span className="font-bold text-emerald-800 font-mono">
            {attendanceRateLabel(attendance.attendanceRate)}
          </span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <section className="portal-metric-grid grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Attendance rate"
          value={attendanceRateLabel(attendance.attendanceRate)}
          icon={CalendarCheck2}
          description={`College target: ≥${COLLEGE_MINIMUM_ATTENDANCE_PERCENT}%`}
        />

        <MetricCard
          label="Present"
          value={String(attendance.presentCount)}
          icon={CalendarCheck2}
          description="Completed sessions attended"
        />

        <MetricCard
          label="Absent"
          value={String(attendance.absentCount)}
          icon={CalendarCheck2}
          description="Missed class sessions"
        />
      </section>

      {attendance.units.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          title="No completed attendance"
          description="Recorded classes will appear here."
        />
      ) : (
        <>
          {/* Unit Breakdown */}
          <section className="overflow-hidden rounded-xl border border-border bg-white shadow-2xs">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Attendance By Unit
              </h2>
              <span className="text-[11px] text-text-muted">
                Target: {COLLEGE_MINIMUM_ATTENDANCE_PERCENT}%
              </span>
            </div>

            <div className="divide-y divide-border">
              {attendance.units.map((unit) => {
                const unitStanding = getAttendanceStanding(unit.attendanceRate);
                const isUnitRisk = unitStanding === 'at_risk';

                return (
                  <article
                    key={unit.unitId}
                    className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_7rem] sm:items-center hover:bg-slate-50/50 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-text-primary">
                        {unit.unitName}
                      </p>
                      {isUnitRisk ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-rose-600">
                          <AlertTriangle className="size-2.5" /> Below {COLLEGE_MINIMUM_ATTENDANCE_PERCENT}% threshold
                        </span>
                      ) : null}
                    </div>

                    <p className="text-[11px] font-mono text-text-muted">
                      {unit.completedSessions} session{unit.completedSessions === 1 ? '' : 's'}
                    </p>

                    <p className="text-[11px] font-mono text-text-muted">
                      <span className="text-emerald-700 font-bold">{unit.presentCount} P</span>
                      {' · '}
                      <span className="text-rose-700 font-bold">{unit.absentCount} A</span>
                    </p>

                    <div className="sm:text-right">
                      <Badge variant={getAttendanceBadgeVariant(unit.attendanceRate)}>
                        {attendanceRateLabel(unit.attendanceRate)}
                      </Badge>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Session History & Missed Lessons */}
          <section className="overflow-hidden rounded-xl border border-border bg-white shadow-2xs">
            <div className="border-b border-border px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-surface-subtle/50">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Class Log
              </h2>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSessionFilter('all')}
                  className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition ${
                    sessionFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-text-secondary border border-border hover:bg-surface-subtle'
                  }`}
                >
                  All Classes ({attendance.sessions.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSessionFilter('missed')}
                  className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition ${
                    sessionFilter === 'missed'
                      ? 'bg-rose-700 text-white'
                      : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  Missed Lessons ({missedSessions.length})
                </button>
              </div>
            </div>

            {displayedSessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                {sessionFilter === 'missed' ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="size-8 text-emerald-500" />
                    <p className="font-bold text-text-primary">No Missed Lessons</p>
                    <p>You have attended 100% of recorded classes!</p>
                  </div>
                ) : (
                  'No class sessions recorded.'
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {displayedSessions.slice(0, 50).map((item) => (
                  <article
                    key={item.classSessionId}
                    className={`grid gap-2 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)_9rem_6rem] sm:items-center transition-colors ${
                      item.status === 'absent' ? 'bg-rose-50/30' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <p className="text-[11px] font-mono font-medium text-text-secondary">
                      {item.sessionDate}
                    </p>

                    <div>
                      <p className="text-xs font-semibold text-text-primary">
                        {item.unitName}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {item.cohortName}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[10.5px] text-text-muted">
                      <Clock className="size-3 text-text-muted/60" />
                      <span>
                        {formatPortalClock(item.startsAt)}–{formatPortalClock(item.endsAt)}
                      </span>
                    </div>

                    <div className="sm:text-right">
                      <Badge variant={item.status === 'present' ? 'success' : 'danger'}>
                        {item.status === 'present' ? 'Present' : 'Absent'}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
