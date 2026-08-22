import {
  AlertTriangle,
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
          <Link
            href="/operations/action-center"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary-hover"
          >
            <ListChecks className="size-3.5" aria-hidden="true" />
            Action Center
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(
          (
            card,
          ) => (
            <Link
              key={
                card.label
              }
              href={
                card.href
              }
              className="block"
            >
              <MetricCard
                label={
                  card.label
                }
                value={String(
                  card.value,
                )}
                description={
                  card.description
                }
                icon={
                  card.icon
                }
                status={
                  card.value >
                  0
                    ? 'Action'
                    : 'Clear'
                }
              />
            </Link>
          ),
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Link
          href="/operations/action-center"
          className="rounded-xl border border-border bg-white px-4 py-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <ListChecks className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-text-primary">
            Action Center
          </p>
          <p className="mt-1 text-[11px] leading-5 text-text-muted">
            Prioritised operational and release follow-up.
          </p>
        </Link>

        <Link
          href="/operations/incidents"
          className="rounded-xl border border-border bg-white px-4 py-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <AlertTriangle className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-text-primary">
            Operational incidents
          </p>
          <p className="mt-1 text-[11px] leading-5 text-text-muted">
            Pilot and Production incident register.
          </p>
        </Link>
        <Link
          href="/operations/attendance"
          className="rounded-xl border border-border bg-white px-4 py-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <p className="text-sm font-semibold text-text-primary">
            Attendance oversight
          </p>

          <p className="mt-1 text-[11px] leading-5 text-text-muted">
            Review trainer class attendance
            and reopen completed records when
            a correction is authorised.
          </p>
        </Link>

        <Link
          href="/teaching-documents/releases"
          className="rounded-xl border border-border bg-white px-4 py-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <p className="text-sm font-semibold text-text-primary">
            Student documents
          </p>

          <p className="mt-1 text-[11px] leading-5 text-text-muted">
            Publish only approved controlled
            documents to the student portal.
          </p>
        </Link>

        <Link
          href="/assessment/reports"
          className="rounded-xl border border-border bg-white px-4 py-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <p className="text-sm font-semibold text-text-primary">
            Academic reports
          </p>

          <p className="mt-1 text-[11px] leading-5 text-text-muted">
            Review assessment completeness
            and performance before release.
          </p>
        </Link>
      </section>
    </div>
  );
}
