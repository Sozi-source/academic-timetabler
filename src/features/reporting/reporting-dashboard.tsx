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
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
            <TableContainer embedded label="Trainer workload report">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Trainer</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Target / Wk</TableHead>
                    <TableHead>Allocated Hrs</TableHead>
                    <TableHead>Timetabled Hrs</TableHead>
                    <TableHead>Assigned Units</TableHead>
                    <TableHead>Workload Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkload.map((w) => (
                    <TableRow key={w.trainerId}>
                      <TableCell className="font-semibold text-text-primary">{w.trainerName}</TableCell>
                      <TableCell className="text-text-secondary">{w.role}</TableCell>
                      <TableCell className="font-medium text-text-muted">{w.normalTargetHours} hrs</TableCell>
                      <TableCell className="font-bold text-text-primary">{w.allocatedHours} hrs</TableCell>
                      <TableCell className="text-text-secondary">{w.scheduledHours} hrs</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1">
                          {w.allocatedUnitCodes.map((c) => (
                            <span key={c} className="rounded bg-surface-subtle px-1.5 py-0.5 text-[11px] font-medium">
                              {c}
                            </span>
                          ))}
                          {w.allocatedUnitCodes.length === 0 && (
                            <span className="text-xs text-text-muted italic">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {w.workloadStatus === 'overload' ? (
                          <Badge variant="warning">Overload (+{w.allocatedHours - w.normalTargetHours}h)</Badge>
                        ) : w.workloadStatus === 'underload' ? (
                          <Badge variant="neutral">Underload ({w.allocatedHours}h)</Badge>
                        ) : (
                          <Badge variant="success">Optimal</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
            <TableContainer embedded label="Teaching allocations report">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Unit</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Assigned Trainer</TableHead>
                    <TableHead>Weekly Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAllocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-semibold text-text-primary" title={a.unitCode}>
                        {a.unitName}
                      </TableCell>
                      <TableCell className="text-text-secondary">{a.cohortName}</TableCell>
                      <TableCell className="font-medium text-text-primary">
                        {a.trainerName ?? <span className="text-danger font-semibold">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-text-muted">{a.weeklyHours} hrs/wk</TableCell>
                      <TableCell>
                        <Badge variant={a.trainerName ? 'success' : 'danger'}>
                          {a.trainerName ? 'Allocated' : 'Unallocated'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
            <TableContainer embedded label="Assessment completion report">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Unit</TableHead>
                    <TableHead>Population</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>CAT Status</TableHead>
                    <TableHead>Final Exam</TableHead>
                    <TableHead>Missing Marks</TableHead>
                    <TableHead>Publication</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssessments.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-semibold text-text-primary" title={ev.unitCode}>
                        <Link href={`/assessment/marks/${ev.id}`} className="hover:underline hover:text-primary">
                          {ev.unitName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {ev.populationCount} {ev.isPopulationLocked ? '🔒' : '🔓'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ev.marksSource === 'excel' ? 'institutional' : ev.marksSource === 'online' ? 'info' : 'neutral'}>
                          {ev.marksSource}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ev.isCatFinalized ? 'success' : 'neutral'}>
                          {ev.isCatFinalized ? 'Complete' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ev.isExamFinalized ? 'success' : 'neutral'}>
                          {ev.isExamFinalized ? 'Complete' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ev.missingMarksCount > 0 ? (
                          <span className="font-bold text-danger">{ev.missingMarksCount} missing</span>
                        ) : (
                          <span className="text-success font-semibold">0 missing</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ev.isPublished ? 'success' : 'neutral'}>
                          {ev.isPublished ? 'Published' : 'Unpublished'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
            <TableContainer embedded label="Registration completion report">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Cohort</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Eligible Students</TableHead>
                    <TableHead>Pre-registered</TableHead>
                    <TableHead>Confirmed</TableHead>
                    <TableHead>Registration Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistration.map((r) => (
                    <TableRow key={r.cohortId}>
                      <TableCell className="font-semibold text-text-primary">{r.cohortName}</TableCell>
                      <TableCell className="text-text-secondary">{r.programmeName}</TableCell>
                      <TableCell className="text-text-muted">{r.stageName}</TableCell>
                      <TableCell className="font-bold text-text-primary">{r.eligibleStudentCount}</TableCell>
                      <TableCell className="text-text-secondary">{r.preRegisteredCount}</TableCell>
                      <TableCell className="text-success font-semibold">{r.confirmedCount}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-surface-subtle rounded-full overflow-hidden">
                            <div
                              style={{ width: `${r.registrationRate}%` }}
                              className="h-full bg-primary"
                            />
                          </div>
                          <span className="font-bold text-text-primary">{r.registrationRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
            <TableContainer embedded label="Class attendance report">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Unit</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Sessions Held</TableHead>
                    <TableHead>Present / Absent</TableHead>
                    <TableHead>Avg Attendance Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.map((att, idx) => (
                    <TableRow key={`${att.unitId}-${idx}`}>
                      <TableCell className="font-semibold text-text-primary" title={att.unitCode}>
                        {att.unitName}
                      </TableCell>
                      <TableCell className="text-text-secondary">{att.cohortName}</TableCell>
                      <TableCell className="text-text-primary">{att.trainerName}</TableCell>
                      <TableCell className="text-text-muted">
                        {att.completedSessions} / {att.totalSessionsScheduled}
                      </TableCell>
                      <TableCell>
                        <span className="text-success font-semibold">{att.totalPresentCount} P</span> · <span className="text-danger font-semibold">{att.totalAbsentCount} A</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={att.averageAttendanceRate >= 75 ? 'success' : 'warning'}>
                          {att.averageAttendanceRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
            <TableContainer embedded label="Teaching documents compliance">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Unit</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead className="text-center">Attendance Sheet</TableHead>
                    <TableHead className="text-center">Course Outline</TableHead>
                    <TableHead className="text-center">Scheme of Work</TableHead>
                    <TableHead className="text-center">Record of Work</TableHead>
                    <TableHead className="text-right">Compliance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => {
                    const badgeFor = (st: string) => {
                      if (st === 'approved') return <Badge variant="success">Approved</Badge>;
                      if (st === 'submitted') return <Badge variant="warning">Submitted</Badge>;
                      if (st === 'draft') return <Badge variant="neutral">Draft</Badge>;
                      return <span className="text-xs text-text-muted italic">—</span>;
                    };

                    return (
                      <TableRow key={doc.allocationId}>
                        <TableCell className="font-semibold text-text-primary" title={doc.unitCode}>
                          {doc.unitName}
                        </TableCell>
                        <TableCell className="text-text-secondary">{doc.cohortName}</TableCell>
                        <TableCell className="text-text-primary">{doc.trainerName}</TableCell>
                        <TableCell className="text-center">{badgeFor(doc.attendanceSheetStatus)}</TableCell>
                        <TableCell className="text-center">{badgeFor(doc.courseOutlineStatus)}</TableCell>
                        <TableCell className="text-center">{badgeFor(doc.schemeOfWorkStatus)}</TableCell>
                        <TableCell className="text-center">{badgeFor(doc.recordOfWorkStatus)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${doc.complianceRate === 100 ? 'text-success' : 'text-text-primary'}`}>
                            {doc.complianceRate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </div>
      )}
    </div>
  );
}
