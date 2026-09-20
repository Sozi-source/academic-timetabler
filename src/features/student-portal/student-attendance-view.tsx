'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import {
  getAttendanceBadgeVariant,
  getAttendanceStanding,
} from '@/features/attendance-analytics/domain';
import type { StudentPortalAttendanceSnapshot } from '@/features/attendance-analytics/types';
import { formatPortalClock } from './domain';

interface StudentAttendanceViewProps {
  attendance: StudentPortalAttendanceSnapshot;
}

const STANDING_COPY: Record<string, { icon: typeof ShieldCheck; text: string; tone: string }> = {
  at_risk: { icon: AlertTriangle, text: 'Action needed', tone: 'rose' },
  borderline: { icon: AlertTriangle, text: 'Watch closely', tone: 'amber' },
  good: { icon: ShieldCheck, text: 'Good standing', tone: 'emerald' },
  unrecorded: { icon: ShieldCheck, text: 'No data yet', tone: 'slate' },
};

export function StudentAttendanceView({
  attendance,
}: StudentAttendanceViewProps) {
  const [sessionFilter, setSessionFilter] = useState<'all' | 'missed'>('all');

  const missedSessions = useMemo(() => {
    return attendance.sessions.filter((s) => s.status === 'absent');
  }, [attendance.sessions]);

  const displayedSessions = sessionFilter === 'missed' ? missedSessions : attendance.sessions;

  const standing = getAttendanceStanding(attendance.attendanceRate);
  const { icon: StandingIcon, text: standingText, tone } = STANDING_COPY[standing];
  const totalSessions = attendance.presentCount + attendance.absentCount;

  return (
    <div className="space-y-4">
      {/* Status strip — one line, no paragraph */}
      <div
        className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs ${
          tone === 'rose'
            ? 'border-rose-200 bg-rose-50/80 text-rose-900'
            : tone === 'amber'
              ? 'border-amber-200 bg-amber-50/80 text-amber-900'
              : tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                : 'border-border bg-surface-subtle text-text-secondary'
        }`}
      >
        <div className="flex items-center gap-2">
          <StandingIcon className="size-4 shrink-0" />
          <span className="font-semibold">{standingText}</span>
        </div>
        <span className="font-bold font-mono">
          {attendance.absentCount} missed
        </span>
      </div>

      {/* Hero + supporting stats */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-[1.1fr_1fr]">
        <Card
          className={`flex items-center justify-between gap-4 p-5 ${
            tone === 'rose'
              ? 'border-rose-200 bg-rose-50/40'
              : tone === 'amber'
                ? 'border-amber-200 bg-amber-50/40'
                : ''
          }`}
        >
          <div>
            <p className="text-xs font-semibold tracking-wide text-text-muted">
              Lessons missed
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-text-primary">
              {attendance.absentCount}
            </p>
          </div>
          <span
            className={`flex size-11 items-center justify-center rounded-full ${
              tone === 'rose'
                ? 'bg-rose-100 text-rose-600'
                : tone === 'amber'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-emerald-100 text-emerald-600'
            }`}
          >
            <StandingIcon className="size-5" />
          </span>
        </Card>

        <Card className="flex flex-col justify-center gap-3 p-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-secondary">Present</span>
            <span className="font-mono font-bold text-text-primary">
              {attendance.presentCount} / {totalSessions}
            </span>
          </div>
          <Progress
            value={attendance.presentCount}
            max={Math.max(totalSessions, 1)}
            indicatorClassName={
              tone === 'rose' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
            }
          />
        </Card>
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
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                By Unit
              </h2>
            </div>

            <div className="divide-y divide-border">
              {attendance.units.map((unit) => {
                const unitStanding = getAttendanceStanding(unit.attendanceRate);
                const isUnitRisk = unitStanding === 'at_risk';
                const unitTotal = unit.presentCount + unit.absentCount;

                return (
                  <article
                    key={unit.unitId}
                    className="grid gap-2.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_5.5rem] sm:items-center hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">
                        {unit.unitName}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {unit.completedSessions} session{unit.completedSessions === 1 ? '' : 's'}
                      </p>
                    </div>

                    <Progress
                      value={unit.presentCount}
                      max={Math.max(unitTotal, 1)}
                      className="h-1.5"
                      indicatorClassName={isUnitRisk ? 'bg-rose-500' : 'bg-emerald-500'}
                    />

                    <div className="sm:text-right">
                      <Badge variant={getAttendanceBadgeVariant(unit.attendanceRate)}>
                        {unit.absentCount} missed
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
                  All ({attendance.sessions.length})
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
                  Missed ({missedSessions.length})
                </button>
              </div>
            </div>

            {displayedSessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                {sessionFilter === 'missed' ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="size-8 text-emerald-500" />
                    <p className="font-bold text-text-primary">No missed lessons</p>
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