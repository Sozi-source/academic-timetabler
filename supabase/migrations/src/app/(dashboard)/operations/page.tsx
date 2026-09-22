import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  FileCheck2,
  ListChecks,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import {
  Badge,
} from '@/components/ui/badge';
import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  operationsAttentionCount,
  operationsReadinessState,
} from '@/features/operations/domain';
import {
  getOperationsReadiness,
} from '@/features/operations/queries';

export default async function OperationsPage() {
  await requireHodAccess();

  const readiness =
    await getOperationsReadiness();

  const state =
    operationsReadinessState(
      readiness,
    );

  const attention =
    operationsAttentionCount(
      readiness,
    );

  const cards = [
    {
      label:
        'Student access',
      value:
        readiness.students
          .accessMissing,
      description:
        `${readiness.students.accessActive} active`,
      href:
        '/students/access',
      icon:
        GraduationCap,
    },
    {
      label:
        'Attendance',
      value:
        readiness.attendance
          .incomplete,
      description:
        `${readiness.attendance.completed} completed`,
      href:
        '/operations/attendance',
      icon:
        ClipboardCheck,
    },
    {
      label:
        'Document review',
      value:
        readiness.documents
          .awaitingReview +
        readiness.documents
          .returned,
      description:
        `${readiness.documents.approvedUnpublished} approved not published`,
      href:
        '/teaching-documents/review',
      icon:
        FileCheck2,
    },
    {
      label:
        'Results release',
      value:
        readiness.assessments
          .finalisedUnpublished,
      description:
        `${readiness.assessments.finalised} finalised`,
      href:
        '/assessment/assessments',
      icon:
        ShieldCheck,
    },
  ] as const;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Quality control"
        title="Operations & QA"
        description="Release-candidate operational checks."
        icon={ShieldCheck}
        context={
          <Badge
            variant={
              state ===
              'ready'
                ? 'success'
                : 'warning'
            }
          >
            {state ===
            'ready'
              ? 'Ready'
              : `${attention} need attention`}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/operations/daily-reports"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              <ClipboardCheck className="size-3.5 text-emerald-800" aria-hidden="true" />
              Trainer Daily Reports
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Dashboard
            </Link>
            <Link
              href="/operations/action-center"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary-hover"
            >
              <ListChecks className="size-3.5" aria-hidden="true" />
              Action Center
            </Link>
          </div>
        }
      />

      {/* 1. Standardized Metric Telemetry Strip */}
      <section aria-label="Operational Telemetry" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const needsAction = card.value > 0;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 shadow-xs transition hover:border-[#033B36]/30 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  {card.label}
                </span>
                <span className={`flex size-7.5 shrink-0 items-center justify-center rounded-lg ${
                  needsAction ? 'bg-amber-50 text-amber-700' : 'bg-[#033B36]/10 text-[#033B36]'
                }`}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold text-gray-900 tracking-tight">
                  {card.value}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">{card.description}</p>
              </div>
              <div className={`mt-3 h-0.5 w-7 rounded-full ${needsAction ? 'bg-amber-500' : 'bg-[#033B36]'}`} />
            </Link>
          );
        })}
      </section>

      {/* 2. Operations Workspaces Grid */}
      <section aria-label="Operations Workspaces" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Link
          href="/operations/action-center"
          className="group rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300 hover:bg-gray-50/70"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#033B36] text-white shadow-2xs transition group-hover:scale-105">
            <ListChecks className="size-4.5 text-[#FACC15]" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs font-bold text-gray-900 group-hover:text-[#033B36] transition-colors">
            Action Center
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Prioritised release follow-up.
          </p>
        </Link>

        <Link
          href="/operations/incidents"
          className="group rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300 hover:bg-gray-50/70"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500 text-white shadow-2xs transition group-hover:scale-105">
            <AlertTriangle className="size-4.5 text-white" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs font-bold text-gray-900 group-hover:text-amber-700 transition-colors">
            Operational Incidents
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Production incident log.
          </p>
        </Link>

        <Link
          href="/operations/attendance"
          className="group rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300 hover:bg-gray-50/70"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#033B36] text-white shadow-2xs transition group-hover:scale-105">
            <ClipboardCheck className="size-4.5 text-white" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs font-bold text-gray-900 group-hover:text-[#033B36] transition-colors">
            Attendance Oversight
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Audit class attendance registers.
          </p>
        </Link>

        <Link
          href="/teaching-documents/releases"
          className="group rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300 hover:bg-gray-50/70"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#033B36] text-white shadow-2xs transition group-hover:scale-105">
            <FileCheck2 className="size-4.5 text-white" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs font-bold text-gray-900 group-hover:text-[#033B36] transition-colors">
            Student Documents
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Publish approved documents.
          </p>
        </Link>

        <Link
          href="/assessment/reports"
          className="group rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition hover:border-gray-300 hover:bg-gray-50/70 sm:col-span-2 lg:col-span-1"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#F59E0B] text-white shadow-2xs transition group-hover:scale-105">
            <ShieldCheck className="size-4.5 text-white" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs font-bold text-gray-900 group-hover:text-[#B45309] transition-colors">
            Academic Reports
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Assessment & marks summary.
          </p>
        </Link>
      </section>
    </div>
  );
}
