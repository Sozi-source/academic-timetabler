import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  actionCenterCounts,
  actionCenterVariant,
  buildActionCenter,
} from '@/features/operations/action-center-domain';
import { getOperationsReadiness } from '@/features/operations/queries';
import {
  getProductionIncidents,
  getReleaseDeployments,
} from '@/features/production-controls/queries';
import {
  getReleaseDefects,
  getReleaseGoLiveStatus,
} from '@/features/system-testing/release-controls-queries';

export default async function OperationsActionCenterPage() {
  await requireHodAccess();

  const [readiness, goLive, defects, deployments, incidents] = await Promise.all([
    getOperationsReadiness(),
    getReleaseGoLiveStatus(),
    getReleaseDefects(300),
    getReleaseDeployments(100),
    getProductionIncidents(300),
  ]);

  const items = buildActionCenter({
    readiness,
    goLive,
    defects,
    deployments,
    incidents,
  });

  const counts = actionCenterCounts(items);

  return (
    <div className="admin-screen space-y-5">
      <PageHeader
        eyebrow="Operations & QA"
        title="Action Center"
        description="One queue for release and operational follow-up."
        icon={ListChecks}
        context={
          <Badge variant={counts.critical > 0 ? 'danger' : counts.warning > 0 ? 'warning' : 'success'}>
            {counts.total === 0 ? 'Clear' : `${counts.total} action${counts.total === 1 ? '' : 's'}`}
          </Badge>
        }
        actions={
          <Link
            href="/operations"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Operations
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Actions" value={String(counts.total)} description="Active queue" icon={ListChecks} />
        <MetricCard label="Critical" value={String(counts.critical)} description="Critical blockers" icon={AlertTriangle} />
        <MetricCard label="Warnings" value={String(counts.warning)} description="Review items" icon={ShieldCheck} />
        <MetricCard label="Information" value={String(counts.info)} description="Advisory notices" icon={CheckCircle2} />
      </section>

      {items.length === 0 ? (
        <section className="rounded-xl border border-success-border bg-success-surface px-4 py-7 text-center">
          <CheckCircle2 className="mx-auto size-5 text-success" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-text-primary">No current actions</p>
          <p className="mt-1 text-[11px] text-text-muted">All operational controls clear.</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="grid gap-2 px-4 py-3.5 transition hover:bg-surface-subtle/60 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center md:gap-3"
              >
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={actionCenterVariant(item.severity)}>
                    {item.severity === 'critical' ? 'Critical' : item.severity === 'warning' ? 'Warning' : 'Info'}
                  </Badge>
                  <Badge variant="neutral">{item.area}</Badge>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-primary">{item.title}</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-text-muted">{item.detail}</p>
                </div>
                <span className="text-[10px] font-semibold text-primary">Open</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
