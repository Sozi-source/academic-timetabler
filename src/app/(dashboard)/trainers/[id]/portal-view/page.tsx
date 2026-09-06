import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  Clock,
  Eye,
  FileSpreadsheet,
  FileText,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { requireHodAccess } from '@/features/auth/authorization';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';
import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';
import { getTrainerAllocations, getTrainerById } from '@/features/trainers/queries';

interface TrainerPortalViewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminTrainerPortalViewPage({
  params,
  searchParams,
}: TrainerPortalViewPageProps) {
  await requireHodAccess();
  const { id } = await params;
  const { tab = 'units' } = await searchParams;

  const trainer = await getTrainerById(id);

  if (!trainer) {
    notFound();
  }

  let workspaceAllocations: any[] = [];
  if (trainer.profileId) {
    try {
      const workspace = await getStaffWorkspace(trainer.profileId);
      workspaceAllocations = workspace.allocations;
    } catch {
      // Fallback if not linked to auth profile yet
    }
  }

  const rawAllocations = await getTrainerAllocations(trainer.id);
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

  const totalWeeklyHours = rawAllocations.reduce((sum, a) => sum + a.weeklyHours, 0);

  return (
    <div className="space-y-4 pb-12">
      {/* Top Admin Banner Notice */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950 shadow-2xs print:hidden">
        <div className="flex items-center gap-2">
          <Eye className="size-4 shrink-0 text-sky-700" aria-hidden="true" />
          <div>
            <p className="font-bold">Admin Mode: Staff / Trainer Portal Preview</p>
            <p className="text-[11px] text-sky-800">
              Inspecting portal workspace for <span className="font-bold">{trainer.fullName}</span> ({trainer.staffNumber || trainer.email || 'Staff Member'})
            </p>
          </div>
        </div>

        <Link
          href={`/trainers/${trainer.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-900 px-3 text-xs font-bold text-white shadow-2xs transition hover:bg-sky-950 active:scale-95"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Staff Record</span>
        </Link>
      </div>

      {/* Header Metadata Card */}
      <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-2xs space-y-3">
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

        {/* Segmented Tab Control */}
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-surface-subtle p-1 border border-border print:hidden text-center">
          {[
            { key: 'units', label: `Teaching Units (${groupedUnits.length})`, icon: BookOpenCheck },
            { key: 'documents', label: 'Teaching Documents', icon: FileText },
            { key: 'attendance', label: 'Attendance Logs', icon: CalendarCheck },
            { key: 'profile', label: 'Trainer Profile', icon: User },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <Link
                key={t.key}
                href={`/trainers/${trainer.id}/portal-view?tab=${t.key}`}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2 text-[11px] font-bold transition active:scale-95 ${
                  active
                    ? 'bg-surface text-primary shadow-xs border border-border-soft'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Units & Markbooks */}
      {tab === 'units' && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">
                Allocated Course Units ({groupedUnits.length})
              </h2>
              <p className="text-xs text-text-muted">
                Consolidated teaching allocations and active markbook entries.
              </p>
            </div>
            <Badge variant="neutral" className="text-xs font-mono">
              {totalWeeklyHours} Total Weekly Hours
            </Badge>
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
                        <span key={c} className="rounded-md bg-surface-subtle border border-border px-2 py-0.5 text-[10.5px] font-bold text-text-secondary">
                          {c}
                        </span>
                      ))}
                      {item.cohortNames.length > 1 && (
                        <Badge variant="primary" className="text-[10px]">
                          Combined ({item.cohortNames.length} Cohorts)
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={item.allocationStatus === 'active' ? 'success' : 'neutral'} className="capitalize">
                      {item.allocationStatus}
                    </Badge>
                    <Link
                      href={`/staff/units/${item.primaryAllocationId || item.allocationId}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-bold text-primary hover:bg-primary-subtle transition"
                    >
                      <Eye className="size-3.5" />
                      <span>Inspect Workspace</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Teaching Documents */}
      {tab === 'documents' && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Syllabus & Teaching Documents Overview
            </h2>
            <Badge variant="neutral">Curriculum Quality Assurance</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-border bg-surface-subtle/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary">Course Outlines</span>
                <BookOpen className="size-4 text-primary" />
              </div>
              <p className="text-xs text-text-muted">Approved syllabus outlines available for print & download.</p>
              <Badge variant="success">Active Outlines Available</Badge>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface-subtle/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary">Schemes of Work</span>
                <FileSpreadsheet className="size-4 text-primary" />
              </div>
              <p className="text-xs text-text-muted">14-Week detailed lesson plan and weekly objectives.</p>
              <Badge variant="success">14 Weeks Configured</Badge>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface-subtle/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary">Record of Work</span>
                <CalendarCheck className="size-4 text-primary" />
              </div>
              <p className="text-xs text-text-muted">Real-time lesson delivery tracking and progress logs.</p>
              <Badge variant="primary">Progress Logs Active</Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 3: Attendance Logs */}
      {tab === 'attendance' && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Attendance Registers & Daily Operation Logs
            </h2>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface-subtle/50 text-xs space-y-2">
            <p className="font-bold text-text-primary">Attendance Compliance Oversight</p>
            <p className="text-text-muted">
              Monthly class attendance sheets, CAT registers, and exam attendance rosters for {trainer.fullName}.
            </p>
            <div className="pt-2">
              <Link
                href="/operations/daily-reports"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white shadow-2xs transition hover:bg-primary-hover"
              >
                <Clock className="size-3.5" />
                <span>Open Operations Register</span>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 4: Profile & Parameters */}
      {tab === 'profile' && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <User className="size-4 text-primary" />
            Trainer Staff Profile & Parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
              <p className="text-[11px] text-text-muted font-medium">Full Name</p>
              <p className="font-bold text-text-primary">{trainer.fullName}</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
              <p className="text-[11px] text-text-muted font-medium">Staff Number</p>
              <p className="font-mono font-bold text-text-primary">{trainer.staffNumber || '—'}</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
              <p className="text-[11px] text-text-muted font-medium">Email Address</p>
              <p className="font-semibold text-text-primary">{trainer.email || '—'}</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
              <p className="text-[11px] text-text-muted font-medium">Employment Type</p>
              <p className="font-bold text-text-primary capitalize">{trainer.employmentType?.replace('_', ' ')}</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
              <p className="text-[11px] text-text-muted font-medium">Normal Weekly Hours</p>
              <p className="font-bold text-text-primary">{trainer.normalWeeklyHours} hrs / week</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
              <p className="text-[11px] text-text-muted font-medium">Max Daily Hours</p>
              <p className="font-bold text-text-primary">{trainer.maximumDailyHours} hrs / day</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
