import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  FlaskConical,
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
  releaseGoLiveLabel,
  releaseGoLiveVariant,
} from '@/features/system-testing/release-controls-domain';
import {
  getReleaseGoLiveStatus,
  getReleaseSignoffs,
} from '@/features/system-testing/release-controls-queries';
import {
  ReleaseSignoffActions,
} from '@/features/system-testing/release-signoff-actions';
import {
  formatTestingDateTime,
} from '@/features/system-testing/release-domain';

export default async function ReleaseSignoffPage() {
  await requireHodAccess();

  const [status, history] = await Promise.all([
    getReleaseGoLiveStatus(),
    getReleaseSignoffs(20),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Release Candidate"
        title="Go-live sign-off"
        description="Final controlled release approval."
        icon={ShieldCheck}
        context={
          <Badge variant={releaseGoLiveVariant(status)}>
            {releaseGoLiveLabel(status)}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/testing/defects"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <Bug className="size-3.5" aria-hidden="true" />
              Defects
            </Link>
            <Link
              href="/testing/deployments"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Deployments
            </Link>
            <Link
              href="/testing"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Testing Center
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Automated gate"
          value={status.eligible || status.activeSignoff ? 'Clear' : 'Blocked'}
          description="Current readiness state"
          icon={CheckCircle2}
        />
        <MetricCard
          label="UAT cases"
          value={`${status.passedRunCaseCount}/${status.activeCatalogCaseCount}`}
          description="Latest passed run / active catalogue"
          icon={FlaskConical}
        />
        <MetricCard
          label="Blocking defects"
          value={String(status.blockerDefects)}
          description="Critical / High unresolved"
          icon={Bug}
        />
        <MetricCard
          label="Warnings"
          value={String(status.warningDefects)}
          description="Medium / Low unresolved"
          icon={Bug}
        />
      </section>

      {!status.activeSignoff && status.reasons.length > 0 ? (
        <section className="rounded-xl border border-danger-border bg-danger-surface px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-danger">Release blockers</p>
          <ul className="mt-2 space-y-1 text-[11px] text-danger">
            {status.reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <ReleaseSignoffActions status={status} />

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-text-primary">Sign-off history</h2>
        </div>

        {history.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-text-muted">No release sign-offs yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {history.map((item) => (
              <article
                key={item.id}
                className="grid gap-2 px-4 py-3 md:grid-cols-[7rem_8rem_minmax(0,1fr)_10rem] md:items-center md:gap-3"
              >
                <Badge variant={item.status === 'approved' ? 'success' : 'neutral'}>
                  {item.status === 'approved' ? 'Approved' : 'Revoked'}
                </Badge>
                <p className="text-[10px] font-semibold text-text-secondary">Suite {item.suiteVersion}</p>
                <p className="truncate text-[10px] text-text-muted">{item.verificationRef}</p>
                <p className="text-[10px] text-text-muted">{formatTestingDateTime(item.approvedAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
