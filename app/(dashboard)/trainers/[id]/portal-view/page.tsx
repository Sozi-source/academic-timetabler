import {
  ArrowLeft,
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  MapPin,
  User,
  Users,
  UsersRound,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { requireHodAccess } from '@/features/auth/authorization';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';
import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';
import {
  getTrainerAttendanceHistoryForAdmin,
  getTrainerAttendanceScheduleForAdmin,
} from '@/features/class-attendance/queries';
import { shortTime } from '@/features/class-attendance/domain';
import { getTrainerAllocations, getTrainerById } from '@/features/trainers/queries';
import {
  formatTimetableClock,
  mergeStaffTimetableSessions,
} from '@/features/staff-workspace/domain';
import { getStaffPublishedTimetable } from '@/features/staff-workspace/queries';
import type { StaffTimetableSession } from '@/features/staff-workspace/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WEEK_DAYS = [
  { key: 'monday', label: 'Monday', seq: 1 },
  { key: 'tuesday', label: 'Tuesday', seq: 2 },
  { key: 'wednesday', label: 'Wednesday', seq: 3 },
  { key: 'thursday', label: 'Thursday', seq: 4 },
  { key: 'friday', label: 'Friday', seq: 5 },
  { key: 'saturday', label: 'Saturday', seq: 6 },
] as const;

function groupByPeriod(sessions: StaffTimetableSession[]) {
  const periods = new Map<string, { name: string; sessions: StaffTimetableSession[] }>();
  for (const s of sessions) {
    const cur = periods.get(s.academicPeriodId) ?? { name: s.academicPeriodName, sessions: [] };
    cur.sessions.push(s);
    periods.set(s.academicPeriodId, cur);
  }
  return [...periods.entries()];
}

function groupByDay(sessions: StaffTimetableSession[]) {
  const days = new Map<string, StaffTimetableSession[]>();
  for (const s of sessions) {
    const key = `${s.daySequence}:${s.dayName}`;
    const cur = days.get(key) ?? [];
    cur.push(s);
    days.set(key, cur);
  }
  return [...days.entries()];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminTrainerPortalViewPage({ params, searchParams }: Props) {
  await requireHodAccess();
  const { id } = await params;
  const { tab = 'timetable' } = await searchParams;

  const trainer = await getTrainerById(id);
  if (!trainer) notFound();

  // ── Fetch all data concurrently ──────────────────────────────────────────
  const rawAllocations = await getTrainerAllocations(trainer.id);

  let workspaceAllocations: any[] = [];
  let trainerId = trainer.id;
  let timetable = { sessions: [] as StaffTimetableSession[] };
  let attendanceSchedule: Awaited<ReturnType<typeof getTrainerAttendanceScheduleForAdmin>> = [];
  let attendanceHistory: Awaited<ReturnType<typeof getTrainerAttendanceHistoryForAdmin>> = [];

  if (trainer.profileId) {
    const [workspace, rawTimetable, schedule, history] = await Promise.all([
      getStaffWorkspace(trainer.profileId).catch(() => null),
      getStaffPublishedTimetable(trainer.profileId).catch(() => ({ sessions: [] })),
      getTrainerAttendanceScheduleForAdmin(trainer.profileId).catch(() => []),
      // history needs trainerId from workspace; fetch workspace first then run separately
      Promise.resolve([] as typeof attendanceHistory),
    ]);

    if (workspace) {
      workspaceAllocations = workspace.allocations;
      trainerId = workspace.trainerId;
    }
    timetable = rawTimetable;
    attendanceSchedule = schedule;
    // Now fetch history with resolved trainerId
    attendanceHistory = await getTrainerAttendanceHistoryForAdmin(trainerId, 30).catch(() => []);
  }

  const groupedUnits = groupStaffUnitAllocations(
    workspaceAllocations.length > 0
      ? workspaceAllocations
      : (rawAllocations.map((a) => ({
          allocationId: a.id,
          academicPeriodId: 'current',
          academicPeriodName: a.academicPeriodName,
          cohortId: a.cohortCode,
          cohortName: a.cohortName,
          unitId: a.unitCode,
          unitCode: a.unitCode,
          unitName: a.unitName,
          allocationStatus: a.status,
          cat: null,
          exam: null,
        })) as any),
  );

  const mergedTimetable = mergeStaffTimetableSessions(timetable.sessions);
  const timetablePeriods = groupByPeriod(mergedTimetable);

  const totalWeeklyHours = rawAllocations.reduce((s, a) => s + a.weeklyHours, 0);

  const completedSessions = attendanceHistory.filter((s) => s.status === 'completed').length;
  const cancelledSessions = attendanceHistory.filter((s) => s.status === 'cancelled').length;
  const openSessions = attendanceHistory.filter((s) => s.status === 'open').length;

  // ── Tabs config ──────────────────────────────────────────────────────────
  const TABS = [
    { key: 'timetable', label: 'Timetable', icon: CalendarDays },
    { key: 'units', label: `Teaching Units (${groupedUnits.length})`, icon: BookOpenCheck },
    { key: 'attendance', label: `Attendance (${attendanceHistory.length})`, icon: CalendarCheck },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'profile', label: 'Profile', icon: User },
  ] as const;

  return (
    <div className="space-y-4 pb-12">
      {/* Admin Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950 shadow-2xs print:hidden">
        <div className="flex items-center gap-2">
          <Eye className="size-4 shrink-0 text-sky-700" aria-hidden="true" />
          <div>
            <p className="font-bold">Admin Mode — Trainer Portal View</p>
            <p className="text-[11px] text-sky-800">
              Viewing portal as{' '}
              <span className="font-bold">{trainer.fullName}</span>{' '}
              ({trainer.staffNumber || trainer.email || 'Staff Member'})
              {!trainer.profileId && ' · No workspace linked'}
            </p>
          </div>
        </div>
        <Link
          href={`/trainers/${trainer.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-900 px-3 text-xs font-bold text-white shadow-2xs transition hover:bg-sky-950 active:scale-95"
        >
          <ArrowLeft className="size-3.5" />
          Staff Record
        </Link>
      </div>

      {/* Header card + tab control */}
      <div className="rounded-xl border border-border bg-surface p-3.5 shadow-2xs space-y-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                {trainer.staffNumber || 'Staff Record'}
              </span>
              <Badge variant={trainer.isActive ? 'success' : 'neutral'}>
                {trainer.isActive ? 'Active Staff' : 'Disabled'}
              </Badge>
              <Badge variant={trainer.profileId ? 'institutional' : 'warning'}>
                {trainer.profileId ? 'Workspace Linked' : 'Workspace Unlinked'}
              </Badge>
            </div>
            <h1 className="mt-1 text-base font-bold text-text-primary sm:text-xl truncate">
              {trainer.fullName}
            </h1>
            <p className="mt-0.5 text-xs text-text-secondary truncate">
              {trainer.email || 'No email set'} · {trainer.homeDepartment || 'Department'} · {totalWeeklyHours} hrs/week
            </p>
          </div>
        </div>

        {/* Tab control */}
        <div className="flex flex-wrap gap-1 rounded-lg bg-surface-subtle p-1 border border-border print:hidden">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <Link
                key={t.key}
                href={`/trainers/${trainer.id}/portal-view?tab=${t.key}`}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2.5 text-[11px] font-bold transition active:scale-95 ${
                  active
                    ? 'bg-surface text-primary shadow-xs border border-border-soft'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="hidden sm:inline truncate">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Tab: Timetable ─────────────────────────────────────────────────── */}
      {tab === 'timetable' && (
        <div className="admin-screen space-y-5">
          {!trainer.profileId ? (
            <EmptyState
              icon={CalendarDays}
              title="No workspace linked"
              description="This trainer's account is not linked to an auth profile — timetable data is unavailable."
            />
          ) : timetablePeriods.length === 0 ? (
            <section className="rounded-lg border border-border bg-surface px-5 py-10 text-center">
              <CalendarDays className="mx-auto size-6 text-text-muted" aria-hidden="true" />
              <p className="mt-2 text-sm font-bold text-text-primary">No published timetable</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">
                The timetable will appear here once teaching allocations are published.
              </p>
            </section>
          ) : (
            timetablePeriods.map(([periodId, period]) => {
              const activeDaySeqs = new Set(period.sessions.map((s) => s.daySequence));
              const visibleDays = WEEK_DAYS.filter((d) => activeDaySeqs.has(d.seq) || d.seq <= 5);
              const timeSlotMap = new Map<string, { startsAt: string; endsAt: string; startSeq: number }>();
              for (const s of period.sessions) {
                const key = `${s.startsAt}-${s.endsAt}`;
                if (!timeSlotMap.has(key)) {
                  timeSlotMap.set(key, { startsAt: s.startsAt, endsAt: s.endsAt, startSeq: s.startSequence });
                }
              }
              const sortedSlots = [...timeSlotMap.values()].sort((a, b) =>
                a.startSeq !== b.startSeq ? a.startSeq - b.startSeq : a.startsAt.localeCompare(b.startsAt),
              );

              return (
                <div key={periodId} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-text-primary">{period.name}</h2>
                      <p className="text-xs text-text-muted">
                        {period.sessions.length} weekly classes · {activeDaySeqs.size} teaching days
                      </p>
                    </div>
                    <span className="rounded border border-primary/20 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                      Published Schedule
                    </span>
                  </div>

                  {/* Desktop weekly grid */}
                  <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                          <th className="w-28 px-3 py-2.5 border-r border-slate-800 text-center">Time</th>
                          {visibleDays.map((d) => (
                            <th key={d.key} className="px-3 py-2.5 border-r border-slate-800 last:border-r-0">{d.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-xs">
                        {sortedSlots.map((slot, si) => (
                          <tr key={`${slot.startsAt}-${slot.endsAt}`} className={si % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                            <td className="border-r border-border px-2.5 py-2.5 text-center bg-slate-50/80 align-top">
                              <span className="font-bold text-text-primary text-xs block">{formatTimetableClock(slot.startsAt)}</span>
                              <span className="text-[10px] text-text-muted block">to {formatTimetableClock(slot.endsAt)}</span>
                            </td>
                            {visibleDays.map((day) => {
                              const matches = period.sessions.filter(
                                (s) => (s.dayName.toLowerCase() === day.key || s.daySequence === day.seq) && s.startsAt === slot.startsAt,
                              );
                              return (
                                <td key={day.key} className="border-r border-border px-2 py-2 align-top last:border-r-0">
                                  {matches.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {matches.map((session) => (
                                        <div key={session.id} className="rounded border border-border bg-white p-2 text-xs">
                                          <p className="font-bold text-text-primary leading-snug">{session.unitName}</p>
                                          <div className="mt-1 flex items-center justify-between text-[11px] text-text-secondary">
                                            <span className="flex items-center gap-1"><MapPin className="size-3 text-text-muted" />{session.roomLabel}</span>
                                            <span className="capitalize text-[10px] text-text-muted">{session.deliveryMode}</span>
                                          </div>
                                          {session.cohortNames.length > 0 && (
                                            <p className="mt-0.5 text-[10px] text-text-muted truncate">{session.cohortNames.join(' · ')}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-text-muted/40 block text-center py-2">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile day-by-day */}
                  <div className="block md:hidden space-y-3">
                    {groupByDay(period.sessions).map(([dayKey, sessions]) => (
                      <div key={dayKey} className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
                        <div className="border-b border-border bg-surface-subtle px-3.5 py-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-text-primary">{sessions[0].dayName}</span>
                          <span className="text-[11px] text-text-muted">{sessions.length} class{sessions.length !== 1 ? 'es' : ''}</span>
                        </div>
                        <div className="divide-y divide-border">
                          {sessions.map((s) => (
                            <div key={s.id} className="p-3 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1 font-bold text-primary">
                                  <Clock3 className="size-3" />{formatTimetableClock(s.startsAt)} – {formatTimetableClock(s.endsAt)}
                                </span>
                                <span className="text-[10px] uppercase font-semibold text-text-muted bg-surface-subtle px-1.5 py-0.5 rounded">{s.deliveryMode}</span>
                              </div>
                              <p className="text-xs font-bold text-text-primary">{s.unitName}</p>
                              <div className="flex items-center justify-between text-[11px] text-text-secondary">
                                <span className="flex items-center gap-1"><MapPin className="size-3 text-text-muted" />{s.roomLabel}</span>
                                {s.cohortNames.length > 0 && (
                                  <span className="flex items-center gap-1 text-text-muted truncate max-w-[160px]">
                                    <Users className="size-3 text-text-muted" />{s.cohortNames.join(' · ')}
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
      )}

      {/* ── Tab: Teaching Units ─────────────────────────────────────────────── */}
      {tab === 'units' && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Allocated Course Units ({groupedUnits.length})</h2>
              <p className="text-xs text-text-muted">Consolidated teaching allocations and active markbook entries.</p>
            </div>
            <Badge variant="neutral" className="text-xs font-mono">{totalWeeklyHours} hrs/week</Badge>
          </div>

          {groupedUnits.length === 0 ? (
            <EmptyState
              icon={BookOpenCheck}
              title="No teaching units assigned"
              description="This trainer has no allocated course units for the current term."
            />
          ) : (
            <div className="space-y-2.5">
              {groupedUnits.map((item) => (
                <div
                  key={item.primaryAllocationId || item.allocationId}
                  className="rounded-xl border border-border bg-surface p-4 shadow-xs flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">{item.unitCode}</span>
                      <span className="font-bold text-xs text-text-primary">{item.unitName}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {item.cohortNames.map((c: string) => (
                        <span key={c} className="rounded-md bg-surface-subtle border border-border px-2 py-0.5 text-[10.5px] font-bold text-text-secondary">{c}</span>
                      ))}
                      {item.cohortNames.length > 1 && <Badge variant="primary" className="text-[10px]">Combined ({item.cohortNames.length} Cohorts)</Badge>}
                    </div>
                    {item.academicPeriodName && (
                      <p className="mt-0.5 text-[10px] text-text-muted">{item.academicPeriodName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.allocationStatus === 'active' ? 'success' : 'neutral'} className="capitalize">
                      {item.allocationStatus}
                    </Badge>
                    <Link
                      href={`/staff/units/${item.primaryAllocationId || item.allocationId}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-bold text-primary hover:bg-primary-soft transition"
                    >
                      <Eye className="size-3.5" />
                      Open Workspace
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: Attendance ─────────────────────────────────────────────────── */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          {/* Metrics */}
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Weekly classes" value={String(attendanceSchedule.length)} icon={Clock3} />
            <MetricCard label="Completed" value={String(completedSessions)} icon={CheckCircle2} />
            <MetricCard label="Did not take place" value={String(cancelledSessions)} icon={CalendarCheck} />
            <MetricCard label="Open" value={String(openSessions)} icon={UsersRound} />
          </div>

          {/* Scheduled sessions (current term) */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">Scheduled Sessions (Current Term)</h2>
              <Badge variant="neutral">{attendanceSchedule.length} sessions</Badge>
            </div>
            {attendanceSchedule.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-text-muted">
                {trainer.profileId ? 'No locked scheduled sessions found for this trainer.' : 'No workspace linked.'}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {attendanceSchedule.map((item) => (
                  <div key={item.scheduledSessionId} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">{item.unitName}</p>
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        {item.cohortName} · {item.dayOfWeek} · {shortTime(item.startsAt)}–{shortTime(item.endsAt)}
                      </p>
                    </div>
                    <Badge variant={
                      item.latestStatus === 'completed' ? 'success'
                      : item.latestStatus === 'cancelled' ? 'neutral'
                      : item.latestStatus === 'open' ? 'warning'
                      : 'neutral'
                    }>
                      {item.latestStatus
                        ? item.latestStatus === 'completed' ? 'Completed'
                          : item.latestStatus === 'cancelled' ? 'Did Not Take Place'
                          : 'Open'
                        : 'Not Yet Taken'}
                    </Badge>
                    <p className="text-[10px] text-text-muted">{item.latestSessionDate ?? '—'}</p>
                    {item.latestClassSessionId ? (
                      <Link
                        href={`/staff/attendance/${item.latestClassSessionId}`}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-[11px] font-bold text-primary hover:bg-primary-soft transition"
                      >
                        <Eye className="size-3" />
                        View Register
                      </Link>
                    ) : (
                      <span className="inline-flex h-7 w-[90px] items-center justify-center rounded-lg border border-border bg-surface-subtle text-[11px] text-text-muted">
                        No record yet
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Session history */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">Recent Attendance Records</h2>
              <Badge variant="neutral">Last {attendanceHistory.length}</Badge>
            </div>
            {attendanceHistory.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-text-muted">No attendance recorded yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {attendanceHistory.map((item) => (
                  <Link
                    key={item.classSessionId}
                    href={`/staff/attendance/${item.classSessionId}`}
                    className="grid gap-3 px-4 py-3 transition hover:bg-surface-subtle md:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">{item.unitName}</p>
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        {item.cohortName} · {item.sessionDate} · {shortTime(item.startsAt)}–{shortTime(item.endsAt)}
                      </p>
                    </div>
                    <Badge variant={
                      item.status === 'completed' ? 'success'
                      : item.status === 'cancelled' ? 'neutral'
                      : 'warning'
                    }>
                      {item.status === 'completed' ? 'Completed' : item.status === 'cancelled' ? 'Did Not Take Place' : 'Open'}
                    </Badge>
                    <p className="text-[10px] text-text-secondary">
                      Present {item.presentCount} · Absent {item.absentCount}
                    </p>
                    <p className="text-[10px] text-text-muted">Unmarked {item.unmarkedCount}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Tab: Documents ──────────────────────────────────────────────────── */}
      {tab === 'documents' && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Teaching Documents
            </h2>
          </div>
          <p className="text-xs text-text-muted">
            Open individual unit workspaces via the Teaching Units tab to view schemes of work, course outlines, records of work, and CAT/exam registers for each allocated unit.
          </p>
          {groupedUnits.length > 0 && (
            <div className="space-y-2">
              {groupedUnits.map((item) => (
                <Link
                  key={item.primaryAllocationId || item.allocationId}
                  href={`/staff/units/${item.primaryAllocationId || item.allocationId}/documents`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 hover:bg-primary-soft transition text-xs"
                >
                  <div>
                    <span className="font-bold text-primary font-mono mr-2">{item.unitCode}</span>
                    <span className="font-semibold text-text-primary">{item.unitName}</span>
                    <p className="mt-0.5 text-[10px] text-text-muted">{item.cohortNames.join(', ')}</p>
                  </div>
                  <Eye className="size-3.5 text-primary shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: Profile ────────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <User className="size-4 text-primary" />
            Trainer Staff Profile &amp; Parameters
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {[
              ['Full Name', trainer.fullName],
              ['Staff Number', trainer.staffNumber || '—'],
              ['Email Address', trainer.email || '—'],
              ['Employment Type', trainer.employmentType?.replace('_', ' ') || '—'],
              ['Normal Weekly Hours', `${trainer.normalWeeklyHours} hrs / week`],
              ['Max Daily Hours', `${trainer.maximumDailyHours} hrs / day`],
              ['Max Weekly Hours', `${trainer.maximumWeeklyHours} hrs / week`],
              ['Home Department', trainer.homeDepartment || '—'],
              ['Specialization', trainer.specialization || '—'],
              ['Workspace Linked', trainer.profileId ? 'Yes' : 'No'],
            ].map(([label, value]) => (
              <div key={label} className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
                <p className="text-[11px] text-text-muted font-medium">{label}</p>
                <p className="font-bold text-text-primary capitalize">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
