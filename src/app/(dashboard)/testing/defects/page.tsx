import {
  ArrowLeft,
  Bug,
  ShieldAlert,
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
  releaseDefectBlocksSignoff,
  releaseDefectSeverityLabel,
  releaseDefectSeverityVariant,
  releaseDefectStatusLabel,
  releaseDefectStatusVariant,
} from '@/features/system-testing/release-controls-domain';
import {
  getReleaseDefects,
} from '@/features/system-testing/release-controls-queries';
import {
  ReleaseDefectActions,
} from '@/features/system-testing/release-defect-actions';
import {
  ReleaseDefectCreateForm,
} from '@/features/system-testing/release-defect-create-form';
import {
  formatTestingDateTime,
} from '@/features/system-testing/release-domain';

export default async function ReleaseDefectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    runId?: string;
    caseKey?: string;
  }>;
}) {
  await requireHodAccess();

  const [params, defects] = await Promise.all([
    searchParams,
    getReleaseDefects(300),
  ]);

  const open = defects.filter((defect) => defect.status !== 'closed').length;
  const blocking = defects.filter(releaseDefectBlocksSignoff).length;
  const closed = defects.filter((defect) => defect.status === 'closed').length;

  return (
    <div className="admin-screen space-y-5">
      <PageHeader
        eyebrow="Release Candidate"
        title="Defect register"
        description="Track UAT issues to verified closure."
        icon={Bug}
        context={
          <Badge variant={blocking > 0 ? 'danger' : 'success'}>
            {blocking} go-live blocker{blocking === 1 ? '' : 's'}
          </Badge>
        }
        actions={
          <Link
            href="/testing"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Testing Center
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Open" value={String(open)} description="All unresolved defects" icon={Bug} />
        <MetricCard label="Blocking" value={String(blocking)} description="Critical / High unresolved" icon={ShieldAlert} />
        <MetricCard label="Closed" value={String(closed)} description="Verified closure" icon={Bug} />
      </section>

      <ReleaseDefectCreateForm
        runId={typeof params.runId === 'string' ? params.runId : null}
        caseKey={typeof params.caseKey === 'string' ? params.caseKey : null}
      />

      {defects.length === 0 ? (
        <section className="rounded-xl border border-border bg-white px-4 py-8 text-center text-xs text-text-muted">
          No release defects logged.
        </section>
      ) : (
        <section className="space-y-3">
          {defects.map((defect) => (
            <article key={defect.id} className="rounded-xl border border-border bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">DEF-{defect.defectNumber}</Badge>
                    <Badge variant={releaseDefectSeverityVariant(defect.severity)}>
                      {releaseDefectSeverityLabel(defect.severity)}
                    </Badge>
                    <Badge variant={releaseDefectStatusVariant(defect.status)}>
                      {releaseDefectStatusLabel(defect.status)}
                    </Badge>
                    {defect.caseKey ? <Badge variant="institutional">{defect.caseKey}</Badge> : null}
                  </div>

                  <h2 className="mt-2 text-sm font-bold text-text-primary">{defect.title}</h2>
                  <p className="mt-1 text-[11px] leading-5 text-text-secondary">{defect.description}</p>
                  <p className="mt-1 text-[9px] text-text-muted">
                    Updated {formatTestingDateTime(defect.updatedAt)}
                  </p>
                </div>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <ReleaseDefectActions defect={defect} />
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
