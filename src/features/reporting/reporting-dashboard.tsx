'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  GraduationCap,
  Layers,
  Presentation,
  Search,
  UserCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import type {
  DepartmentExecutiveReportData,
  ReportingPillar,
} from './types';

export function ReportingDashboard({ data }: { data: DepartmentExecutiveReportData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReportingPillar>('overview');
  const [search, setSearch] = useState('');

  const handlePeriodChange = (periodId: string) => {
    router.push(`/reports?periodId=${periodId}`);
  };

  // Search filters per tab
  const filteredWorkload = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.workload;
    return data.workload.filter(
      (w) =>
        w.trainerName.toLowerCase().includes(q) ||
        w.role.toLowerCase().includes(q) ||
        w.allocatedUnitCodes.some((code) => code.toLowerCase().includes(q))
    );
  }, [data.workload, search]);

  const filteredAllocations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.allocations;
    return data.allocations.filter(
      (a) =>
        a.unitCode.toLowerCase().includes(q) ||
        a.unitName.toLowerCase().includes(q) ||
        a.cohortName.toLowerCase().includes(q) ||
        (a.trainerName && a.trainerName.toLowerCase().includes(q))
    );
  }, [data.allocations, search]);

  const filteredAssessments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.assessments;
    return data.assessments.filter(
      (a) =>
        a.unitCode.toLowerCase().includes(q) ||
        a.unitName.toLowerCase().includes(q)
    );
  }, [data.assessments, search]);

  const filteredRegistration = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.registration;
    return data.registration.filter(
      (r) =>
        r.cohortName.toLowerCase().includes(q) ||
        r.programmeName.toLowerCase().includes(q) ||
        r.stageName.toLowerCase().includes(q)
    );
  }, [data.registration, search]);

  const filteredAttendance = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.attendance;
    return data.attendance.filter(
      (a) =>
        a.unitCode.toLowerCase().includes(q) ||
        a.unitName.toLowerCase().includes(q) ||
        a.cohortName.toLowerCase().includes(q) ||
        a.trainerName.toLowerCase().includes(q)
    );
  }, [data.attendance, search]);

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.documents;
    return data.documents.filter(
      (d) =>
        d.unitCode.toLowerCase().includes(q) ||
        d.unitName.toLowerCase().includes(q) ||
        d.cohortName.toLowerCase().includes(q) ||
        d.trainerName.toLowerCase().includes(q)
    );
  }, [data.documents, search]);

  const tabOptions: Array<{ id: ReportingPillar; label: string; icon: typeof BarChart3; count?: number }> = [
    { id: 'overview', label: 'Executive Scorecard', icon: Layers },
    { id: 'workload', label: 'Trainer Workload', icon: UserCheck, count: data.workload.length },
    { id: 'allocations', label: 'Teaching Allocations', icon: Presentation, count: data.allocations.length },
    { id: 'assessments', label: 'Assessment Completion', icon: FileCheck2, count: data.assessments.length },
    { id: 'registration', label: 'Unit Registration', icon: GraduationCap, count: data.registration.length },
    { id: 'attendance', label: 'Class Attendance', icon: CalendarCheck2, count: data.attendance.length },
    { id: 'documents', label: 'Teaching Documents', icon: FileText, count: data.documents.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="Intelligence & Oversight"
        title="Department Academic Reports"
        description="Comprehensive operational reporting and compliance scorecards across all academic pillars."
        icon={BarChart3}
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{data.departmentName}</Badge>
            <select
              value={data.selectedPeriodId}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="h-7 rounded-md border border-border bg-surface px-2 text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {data.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.status === 'active' ? '(Active)' : `(${p.status})`}
                </option>
              ))}
            </select>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:border-primary hover:text-primary"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Dashboard
            </Link>
            <Link
              href="/operations"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:border-primary hover:text-primary"
            >
              <ClipboardCheck className="size-3.5" aria-hidden="true" />
              Operations Hub
            </Link>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        <div className="flex gap-1">
          {tabOptions.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearch('');
                }}
                className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:border-border-strong hover:text-text-primary'
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {tab.label}
                {tab.count !== undefined ? (
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isActive ? 'bg-primary/10 text-primary' : 'bg-surface-subtle text-text-muted'
                  }`}>
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW SCORECARD */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {/* Workload Card */}
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-muted">1. Trainer Workload</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {data.summary.trainerWorkload.optimalCount} / {data.summary.trainerWorkload.totalTrainers}
                  </p>
                  <p className="text-xs text-text-secondary">Trainers within target workload</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <UserCheck className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3 text-[11px]">
                <Badge variant={data.summary.trainerWorkload.overloadCount > 0 ? 'warning' : 'success'}>
                  {data.summary.trainerWorkload.overloadCount} Overloaded
                </Badge>
                <Badge variant="neutral">
                  {data.summary.trainerWorkload.averageWeeklyHours} hrs avg / trainer
                </Badge>
              </div>
            </Card>

            {/* Allocations Card */}
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-muted">2. Teaching Allocations</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {data.summary.teachingAllocations.allocationRate}%
                  </p>
                  <p className="text-xs text-text-secondary">
                    {data.summary.teachingAllocations.allocatedCount} of {data.summary.teachingAllocations.totalOfferings} units assigned
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Presentation className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3 text-[11px]">
                {data.summary.teachingAllocations.unallocatedCount > 0 ? (
                  <Badge variant="danger">{data.summary.teachingAllocations.unallocatedCount} Unassigned</Badge>
                ) : (
                  <Badge variant="success">100% Fully Allocated</Badge>
                )}
              </div>
            </Card>

            {/* Assessments Card */}
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-muted">3. Assessment Markbooks</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {data.summary.assessments.finalisedCount} / {data.summary.assessments.totalMarkbooks}
                  </p>
                  <p className="text-xs text-text-secondary">Finalised markbooks ({data.summary.assessments.completionRate}%)</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <FileCheck2 className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3 text-[11px]">
                <Badge variant={data.summary.assessments.totalMissingMarks > 0 ? 'warning' : 'success'}>
                  {data.summary.assessments.totalMissingMarks} Missing Marks
                </Badge>
                <Badge variant="neutral">{data.summary.assessments.publishedCount} Published</Badge>
              </div>
            </Card>

            {/* Registration Card */}
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-muted">4. Unit Registration</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {data.summary.registration.registrationRate}%
                  </p>
                  <p className="text-xs text-text-secondary">
                    {data.summary.registration.registeredStudents} of {data.summary.registration.eligibleStudents} students
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <GraduationCap className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3 text-[11px]">
                <Badge variant="neutral">{data.summary.registration.totalCohorts} Active Cohorts</Badge>
              </div>
            </Card>

            {/* Attendance Card */}
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-muted">5. Class Attendance</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {data.summary.attendance.averageStudentAttendanceRate}%
                  </p>
                  <p className="text-xs text-text-secondary">
                    Average student presence across classes
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <CalendarCheck2 className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3 text-[11px]">
                <Badge variant="neutral">
                  {data.summary.attendance.completedSessions} of {data.summary.attendance.totalSessions} sessions completed
                </Badge>
              </div>
            </Card>

            {/* Teaching Documents Card */}
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-muted">6. Document Compliance</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {data.summary.documents.complianceRate}%
                  </p>
                  <p className="text-xs text-text-secondary">
                    {data.summary.documents.approvedCount} of {data.summary.documents.totalRequired} documents approved
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <FileText className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3 text-[11px]">
                <Badge variant={data.summary.documents.submittedCount > 0 ? 'warning' : 'neutral'}>
                  {data.summary.documents.submittedCount} Pending HOD Review
                </Badge>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: TRAINER WORKLOAD */}
      {activeTab === 'workload' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search trainers or units..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Link
              href="/timetable/trainers"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Manage Trainers →
            </Link>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Trainer</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Target / Wk</th>
                    <th className="px-3 py-3">Allocated Hrs</th>
                    <th className="px-3 py-3">Timetabled Hrs</th>
                    <th className="px-3 py-3">Assigned Units</th>
                    <th className="px-3 py-3">Workload Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredWorkload.map((w) => (
                    <tr key={w.trainerId} className="hover:bg-surface-subtle/50">
                      <td className="px-4 py-3 font-semibold text-text-primary">{w.trainerName}</td>
                      <td className="px-3 py-3 text-text-secondary">{w.role}</td>
                      <td className="px-3 py-3 font-medium text-text-muted">{w.normalTargetHours} hrs</td>
                      <td className="px-3 py-3 font-bold text-text-primary">{w.allocatedHours} hrs</td>
                      <td className="px-3 py-3 text-text-secondary">{w.scheduledHours} hrs</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {w.allocatedUnitCodes.map((c) => (
                            <span key={c} className="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium">
                              {c}
                            </span>
                          ))}
                          {w.allocatedUnitCodes.length === 0 && (
                            <span className="text-[11px] text-text-muted italic">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {w.workloadStatus === 'overload' ? (
                          <Badge variant="warning">Overload (+{w.allocatedHours - w.normalTargetHours}h)</Badge>
                        ) : w.workloadStatus === 'underload' ? (
                          <Badge variant="neutral">Underload ({w.allocatedHours}h)</Badge>
                        ) : (
                          <Badge variant="success">Optimal</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: TEACHING ALLOCATIONS */}
      {activeTab === 'allocations' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search units, cohorts, or trainers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Link
              href="/timetable/teaching-allocations"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Edit Allocations →
            </Link>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-3 py-3">Cohort</th>
                    <th className="px-3 py-3">Assigned Trainer</th>
                    <th className="px-3 py-3">Weekly Hours</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAllocations.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-subtle/50">
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {a.unitCode} · <span className="font-normal text-text-secondary">{a.unitName}</span>
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{a.cohortName}</td>
                      <td className="px-3 py-3 font-medium text-text-primary">
                        {a.trainerName ?? <span className="text-danger font-semibold">Unassigned</span>}
                      </td>
                      <td className="px-3 py-3 text-text-muted">{a.weeklyHours} hrs/wk</td>
                      <td className="px-3 py-3">
                        <Badge variant={a.trainerName ? 'success' : 'danger'}>
                          {a.trainerName ? 'Allocated' : 'Unallocated'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: ASSESSMENT COMPLETION */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search unit markbooks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Link
              href="/assessment"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Assessment Control Centre →
            </Link>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-3 py-3">Population</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">CAT Status</th>
                    <th className="px-3 py-3">Final Exam</th>
                    <th className="px-3 py-3">Missing Marks</th>
                    <th className="px-3 py-3">Publication</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAssessments.map((ev) => (
                    <tr key={ev.id} className="hover:bg-surface-subtle/50">
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        <Link href={`/assessment/marks/${ev.id}`} className="hover:underline hover:text-primary">
                          {ev.unitCode} · {ev.unitName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-text-secondary">
                        {ev.populationCount} {ev.isPopulationLocked ? '🔒' : '🔓'}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={ev.marksSource === 'excel' ? 'institutional' : ev.marksSource === 'online' ? 'info' : 'neutral'}>
                          {ev.marksSource}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={ev.isCatFinalized ? 'success' : 'neutral'}>
                          {ev.isCatFinalized ? 'Complete' : 'Pending'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={ev.isExamFinalized ? 'success' : 'neutral'}>
                          {ev.isExamFinalized ? 'Complete' : 'Pending'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        {ev.missingMarksCount > 0 ? (
                          <span className="font-bold text-danger">{ev.missingMarksCount} missing</span>
                        ) : (
                          <span className="text-success font-semibold">0 missing</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={ev.isPublished ? 'success' : 'neutral'}>
                          {ev.isPublished ? 'Published' : 'Unpublished'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: REGISTRATION COMPLETION */}
      {activeTab === 'registration' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search cohorts or programmes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Cohort</th>
                    <th className="px-3 py-3">Programme</th>
                    <th className="px-3 py-3">Stage</th>
                    <th className="px-3 py-3">Eligible Students</th>
                    <th className="px-3 py-3">Pre-registered</th>
                    <th className="px-3 py-3">Confirmed</th>
                    <th className="px-3 py-3">Registration Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRegistration.map((r) => (
                    <tr key={r.cohortId} className="hover:bg-surface-subtle/50">
                      <td className="px-4 py-3 font-semibold text-text-primary">{r.cohortName}</td>
                      <td className="px-3 py-3 text-text-secondary">{r.programmeName}</td>
                      <td className="px-3 py-3 text-text-muted">{r.stageName}</td>
                      <td className="px-3 py-3 font-bold text-text-primary">{r.eligibleStudentCount}</td>
                      <td className="px-3 py-3 text-text-secondary">{r.preRegisteredCount}</td>
                      <td className="px-3 py-3 text-success font-semibold">{r.confirmedCount}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 w-16 bg-surface-subtle rounded-full overflow-hidden">
                            <div
                              style={{ width: `${r.registrationRate}%` }}
                              className="h-full bg-primary"
                            />
                          </div>
                          <span className="font-bold text-text-primary">{r.registrationRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 6: CLASS ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search classes or trainers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Link
              href="/attendance"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Class Attendance Dashboard →
            </Link>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-3 py-3">Cohort</th>
                    <th className="px-3 py-3">Trainer</th>
                    <th className="px-3 py-3">Sessions Held</th>
                    <th className="px-3 py-3">Present / Absent</th>
                    <th className="px-3 py-3">Avg Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAttendance.map((att, idx) => (
                    <tr key={`${att.unitId}-${idx}`} className="hover:bg-surface-subtle/50">
                      <td className="px-4 py-3 font-semibold text-text-primary">{att.unitCode} · {att.unitName}</td>
                      <td className="px-3 py-3 text-text-secondary">{att.cohortName}</td>
                      <td className="px-3 py-3 text-text-primary">{att.trainerName}</td>
                      <td className="px-3 py-3 text-text-muted">
                        {att.completedSessions} / {att.totalSessionsScheduled} completed
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-success font-semibold">{att.totalPresentCount} P</span> · <span className="text-danger font-semibold">{att.totalAbsentCount} A</span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={att.averageAttendanceRate >= 75 ? 'success' : 'warning'}>
                          {att.averageAttendanceRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 7: TEACHING DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search unit documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-3 py-3">Trainer</th>
                    <th className="px-2 py-3 text-center">Attendance Sheet</th>
                    <th className="px-2 py-3 text-center">Course Outline</th>
                    <th className="px-2 py-3 text-center">Scheme of Work</th>
                    <th className="px-2 py-3 text-center">Record of Work</th>
                    <th className="px-3 py-3 text-right">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDocuments.map((doc) => {
                    const badgeFor = (st: string) => {
                      if (st === 'approved') return <Badge variant="success">Approved</Badge>;
                      if (st === 'submitted') return <Badge variant="warning">Submitted</Badge>;
                      if (st === 'draft') return <Badge variant="neutral">Draft</Badge>;
                      return <span className="text-[10px] text-text-muted italic">—</span>;
                    };

                    return (
                      <tr key={doc.allocationId} className="hover:bg-surface-subtle/50">
                        <td className="px-4 py-3 font-semibold text-text-primary">
                          {doc.unitCode} · <span className="font-normal text-text-secondary">{doc.cohortName}</span>
                        </td>
                        <td className="px-3 py-3 text-text-primary">{doc.trainerName}</td>
                        <td className="px-2 py-3 text-center">{badgeFor(doc.attendanceSheetStatus)}</td>
                        <td className="px-2 py-3 text-center">{badgeFor(doc.courseOutlineStatus)}</td>
                        <td className="px-2 py-3 text-center">{badgeFor(doc.schemeOfWorkStatus)}</td>
                        <td className="px-2 py-3 text-center">{badgeFor(doc.recordOfWorkStatus)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-bold ${doc.complianceRate === 100 ? 'text-success' : 'text-text-primary'}`}>
                            {doc.complianceRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
