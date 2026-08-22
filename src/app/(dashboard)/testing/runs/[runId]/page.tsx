import { ArrowLeft, Download, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  formatTestingDateTime,
  releaseOutcomeLabel,
  releaseOutcomeVariant,
} from '@/features/system-testing/release-domain';
import { getReleaseTestRunWorkspace } from '@/features/system-testing/release-queries';
import { ReleaseRunManager } from '@/features/system-testing/release-run-manager';

interface PageProps {
  params: Promise<{ runId: string }>;
}

export default async function ReleaseTestRunPage({ params }: PageProps) {
  await requireHodAccess();
  const { runId } = await params;
  const workspace = await getReleaseTestRunWorkspace(runId);

  if (!workspace) notFound();

  const { run, cases } = workspace;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Release Testing · Suite ${run.suiteVersion}`}
        title="UAT run"
        description={`${run.departmentName} · ${run.academicPeriodName ?? 'No active period snapshot'}`}
        icon={FlaskConical}
        context={
          <Badge variant={releaseOutcomeVariant(run.outcome)}>
            {releaseOutcomeLabel(run.outcome)}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/testing"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Testing Center
            </Link>

            <Link
              href={`/api/testing/runs/${run.id}/export`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary-hover"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Export Excel
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">Started {formatTestingDateTime(run.startedAt)}</Badge>
        <Badge variant={run.startReadiness.blockerCount > 0 ? 'danger' : 'success'}>
          Start blockers {run.startReadiness.blockerCount}
        </Badge>
        <Badge variant={run.startReadiness.warningCount > 0 ? 'warning' : 'success'}>
          Start warnings {run.startReadiness.warningCount}
        </Badge>
        {run.completedAt ? (
          <Badge variant="neutral">Completed {formatTestingDateTime(run.completedAt)}</Badge>
        ) : null}
      </div>

      {run.outcome === 'failed' ? (
        <section className="rounded-xl border border-danger-border bg-danger-surface px-4 py-3">
          <p className="text-[11px] leading-5 text-danger">
            This run is not a release approval. Resolve failed or blocked required tests and
            automated readiness blockers, then start a new UAT run.
          </p>
        </section>
      ) : null}

      {run.outcome === 'passed' ? (
        <section className="rounded-xl border border-success-border bg-success-surface px-4 py-3">
          <p className="text-[11px] leading-5 text-success">
            Required UAT cases passed and the completion readiness gate contained no blockers.
          </p>
        </section>
      ) : null}

      <ReleaseRunManager run={run} cases={cases} />
    </div>
  );
}
