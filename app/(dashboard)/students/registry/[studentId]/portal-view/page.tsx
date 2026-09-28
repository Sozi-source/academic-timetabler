import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  GraduationCap,
  Printer,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StudentPortalShell } from '@/components/student/student-portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PrintActionButton } from '@/components/ui/print-action-button';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  activeStudentUnits,
  studentRegistrationLabel,
  studentStageLabel,
} from '@/features/student-portal/domain';
import { getStudentPortalRegistrationContext } from '@/features/student-portal/queries';
import { UnitRegistrationFormPreview } from '@/features/student-unit-registration/unit-registration-form-preview';

interface AdminStudentPortalViewPageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminStudentPortalViewPage({
  params,
  searchParams,
}: AdminStudentPortalViewPageProps) {
  await requireHodAccess();
  const { studentId } = await params;
  const { tab = 'registration' } = await searchParams;

  const context = await getStudentPortalRegistrationContext(studentId);

  if (!context || !context.student) {
    notFound();
  }

  const units = activeStudentUnits(context.units);

  return (
    <StudentPortalShell
      student={context.student}
      isAdminPreview={true}
      studentId={context.student.id}
      activeTab={tab}
    >
      <div className="space-y-4">
        {/* Top Admin Banner Notice */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <Eye className="size-4 shrink-0 text-sky-700" aria-hidden="true" />
            <div>
              <p className="font-bold">Admin Mode: Student Portal Preview</p>
              <p className="text-[11px] text-sky-800">
                Inspecting portal for <span className="font-bold">{context.student.fullName}</span> ({context.student.admissionNumber})
              </p>
            </div>
          </div>

          <Link
            href={`/students/registry/${context.student.id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-900 px-3 text-xs font-bold text-white shadow-2xs transition hover:bg-sky-950 active:scale-95"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Record</span>
          </Link>
        </div>

        {/* Header Metadata Card */}
        <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  {context.student.admissionNumber}
                </span>
                <Badge
                  variant={
                    context.registrationState === 'confirmed'
                      ? 'success'
                      : context.registrationState === 'deregistered'
                        ? 'warning'
                        : 'institutional'
                  }
                >
                  {studentRegistrationLabel(context.registrationState)}
                </Badge>
                <Badge variant={context.reportingStatus === 'reported' ? 'success' : 'warning'}>
                  {context.reportingStatus === 'reported' ? 'Reporting Confirmed' : 'Reporting Pending'}
                </Badge>
              </div>

              <h1 className="mt-1 text-base font-bold text-text-primary sm:text-xl truncate">
                {context.student.fullName}
              </h1>
              <p className="mt-0.5 text-xs text-text-secondary truncate">
                {context.student.programmeCode} · {context.student.cohortName ?? 'Cohort'} · {context.period?.name ?? 'Academic Session'}
              </p>
            </div>

            {/* Clean Balanced 2-Button Grid (Only shown when document is available) */}
            {units.length > 0 && Boolean(context.period) && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center print:hidden shrink-0">
                <PrintActionButton
                  label="Print / PDF"
                  className="w-full inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary shadow-2xs transition hover:bg-surface-subtle active:scale-95"
                />
                <a
                  href={`/api/students/unit-registration/${context.student.id}/form`}
                  className="w-full inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white shadow-2xs transition hover:bg-primary-hover active:scale-95"
                >
                  <Download className="size-3.5" />
                  <span className="truncate">Download Official PDF</span>
                </a>
              </div>
            )}
          </div>

          {/* Clean Segmented Tab Control (Zero scrollbars) */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-subtle p-1 border border-border print:hidden text-center">
            {[
              { key: 'registration', label: 'Unit Registration', icon: BookOpenCheck },
              { key: 'units', label: `Units (${units.length})`, icon: BookOpen },
              { key: 'profile', label: 'Student Profile', icon: UserRound },
            ].map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <Link
                  key={t.key}
                  href={`/students/registry/${context.student.id}/portal-view?tab=${t.key}`}
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

        {/* Tab Content Display */}
        {tab === 'registration' && (
          <div>
            {!context.period ? (
              <EmptyState
                icon={BookOpenCheck}
                title="No active academic period"
                description="Activate an academic period to view student unit registration."
              />
            ) : units.length === 0 ? (
              <EmptyState
                icon={BookOpenCheck}
                title="No registered units"
                description="This student has no pre-registered units for the active academic period."
              />
            ) : (
              <div className="xl:grid xl:grid-cols-12 xl:gap-6 xl:items-start space-y-4 xl:space-y-0">
                {/* Left Column (Desktop Sidebar / Panel) */}
                <div className="xl:col-span-5 2xl:col-span-4 xl:sticky xl:top-20 xl:self-start space-y-4 print:hidden">
                  {/* Card 1: Admin Overview & Actions */}
                  <Card className="p-4 space-y-3 border-border shadow-2xs">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <FileCheck2 className="size-3.5 text-primary" />
                        Form Overview
                      </p>
                      <Badge variant="neutral" className="text-[10px] font-mono">
                        {units.length} Units
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-text-secondary">
                        <span>Registration Status</span>
                        <Badge
                          variant={
                            context.registrationState === 'confirmed'
                              ? 'success'
                              : context.registrationState === 'deregistered'
                                ? 'warning'
                                : 'institutional'
                          }
                        >
                          {studentRegistrationLabel(context.registrationState)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-text-secondary">
                        <span>Reporting Status</span>
                        <Badge variant={context.reportingStatus === 'reported' ? 'success' : 'warning'}>
                          {context.reportingStatus === 'reported' ? 'Confirmed' : 'Pending'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-text-secondary">
                        <span>Academic Session</span>
                        <span className="font-bold text-text-primary">{context.period.name}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border space-y-2">
                      <a
                        href={`/api/students/unit-registration/${context.student.id}/form`}
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white shadow-2xs transition hover:bg-primary-hover active:scale-95"
                      >
                        <Download className="size-3.5" />
                        <span>Download Official PDF</span>
                      </a>
                      <PrintActionButton
                        label="Print Document"
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary shadow-2xs transition hover:bg-surface-subtle active:scale-95"
                      />
                    </div>
                  </Card>

                  {/* Card 2: Registered Units Summary */}
                  <Card className="p-4 space-y-3 border-border shadow-2xs">
                    <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <BookOpen className="size-3.5 text-primary" />
                      Assigned Units Summary ({units.length})
                    </p>

                    <div className="divide-y divide-border max-h-60 overflow-y-auto pr-1">
                      {units.map((u) => (
                        <div key={u.unitCode} className="py-2 flex items-start justify-between gap-2 text-[11px]">
                          <div className="min-w-0">
                            <span className="font-bold font-mono text-text-primary">{u.unitCode}</span>
                            <p className="text-text-secondary truncate text-[10.5px]">{u.unitName}</p>
                          </div>
                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 mt-0.5" />
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Right Column: Centered A4 Form Canvas */}
                <div className="xl:col-span-7 2xl:col-span-8 space-y-3">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary-subtle p-3 text-xs text-primary-deep print:hidden">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck2 className="size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="font-bold text-text-primary">Official Unit Registration Form</p>
                        <p className="text-[11px] text-text-secondary truncate">
                          Pre-filled form generated for <span className="font-bold">{context.student.fullName}</span>.
                        </p>
                      </div>
                    </div>
                    <Badge variant="neutral" className="text-[10px] font-mono bg-surface shrink-0">
                      A4 Single Page
                    </Badge>
                  </div>

                  <div className="rounded-xl border border-border bg-slate-100/80 p-2 sm:p-5 print:border-none print:bg-white print:p-0 shadow-xs">
                    <UnitRegistrationFormPreview context={context} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'units' && (
          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-bold text-text-primary">
              Registered Course Units ({units.length})
            </h2>
            {units.length === 0 ? (
              <p className="text-xs text-text-muted">No units registered for this session.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {units.map((unit) => (
                  <div key={unit.unitCode} className="p-3 rounded-lg border border-border bg-surface-subtle/50 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-primary">{unit.unitCode}</span>
                      <p className="text-xs font-semibold text-text-primary mt-0.5">{unit.unitName}</p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] border-t border-border/60 pt-2">
                      <span className="text-text-muted">Status</span>
                      <Badge variant="success">Registered</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === 'profile' && (
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <UserRound className="size-4 text-primary" />
              Student Profile Record
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
                <p className="text-[11px] text-text-muted font-medium">Full Name</p>
                <p className="font-bold text-text-primary">{context.student.fullName}</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
                <p className="text-[11px] text-text-muted font-medium">Admission No.</p>
                <p className="font-mono font-bold text-text-primary">{context.student.admissionNumber}</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
                <p className="text-[11px] text-text-muted font-medium">Programme</p>
                <p className="font-bold text-text-primary">{context.student.programmeCode} - {context.student.programmeName}</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface-subtle/50 space-y-1">
                <p className="text-[11px] text-text-muted font-medium">Current Cohort</p>
                <p className="font-bold text-text-primary">{context.student.cohortName ?? 'Not Assigned'}</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </StudentPortalShell>
  );
}
