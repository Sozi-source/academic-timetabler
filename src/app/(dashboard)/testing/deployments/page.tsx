import {
  ArrowLeft,
  Download,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  activeDeployment,
  deploymentEnvironmentLabel,
  deploymentStatusLabel,
  deploymentStatusVariant,
  formatProductionTime,
  incidentBlocksProduction,
} from '@/features/production-controls/domain';
import {
  DeploymentCreateForm,
  DeploymentRollbackAction,
} from '@/features/production-controls/deployment-actions';
import {
  getProductionIncidents,
  getReleaseDeployments,
} from '@/features/production-controls/queries';
import { getReleaseGoLiveStatus } from '@/features/system-testing/release-controls-queries';

export default async function ReleaseDeploymentsPage() {
  await requireHodAccess();

  const [deployments, incidents, goLive] = await Promise.all([
    getReleaseDeployments(100),
    getProductionIncidents(300),
    getReleaseGoLiveStatus(),
  ]);

  const pilot = activeDeployment(deployments, 'pilot');
  const production = activeDeployment(deployments, 'production');
  const blockers = incidents.filter(incidentBlocksProduction).length;
  const canDeployPilot = goLive.eligible || goLive.signoffValid;
  const canDeployProduction = goLive.signoffValid && blockers === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Release Candidate"
        title="Deployment register"
        description="Controlled Pilot and Production release evidence."
        icon={Rocket}
        context={
          <Badge variant={canDeployProduction ? 'success' : 'warning'}>
            {canDeployProduction ? 'Production gate clear' : 'Production gated'}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/api/testing/release-evidence"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Release evidence
            </Link>
            <Link
              href="/testing/sign-off"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Go-live
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Pilot" value={pilot?.versionLabel ?? 'None'} description="Current recorded Pilot" icon={Rocket} />
        <MetricCard label="Production" value={production?.versionLabel ?? 'None'} description="Current recorded Production" icon={ShieldCheck} />
        <MetricCard label="Deployments" value={String(deployments.length)} description="Immutable history" icon={Rocket} />
        <MetricCard label="Incident blockers" value={String(blockers)} description="Critical / High operational" icon={ShieldCheck} />
      </section>

      <DeploymentCreateForm
        canDeployPilot={canDeployPilot}
        canDeployProduction={canDeployProduction}
      />

      {deployments.length === 0 ? (
        <section className="rounded-xl border border-border bg-white px-4 py-8 text-center text-xs text-text-muted">
          No deployment evidence recorded yet.
        </section>
      ) : (
        <section className="space-y-3">
          {deployments.map((deployment) => (
            <article key={deployment.id} className="rounded-xl border border-border bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="institutional">{deploymentEnvironmentLabel(deployment.environment)}</Badge>
                    <Badge variant={deploymentStatusVariant(deployment.status)}>
                      {deploymentStatusLabel(deployment.status)}
                    </Badge>
                    <Badge variant="neutral">Suite {deployment.suiteVersion}</Badge>
                  </div>
                  <h2 className="mt-2 text-sm font-bold text-text-primary">{deployment.versionLabel}</h2>
                  <p className="mt-1 text-[10px] text-text-muted">
                    {formatProductionTime(deployment.deployedAt)}
                    {deployment.deployedByName ? ` · ${deployment.deployedByName}` : ''}
                  </p>
                  {deployment.verificationRef ? (
                    <p className="mt-1 text-[10px] text-text-muted">Verification: {deployment.verificationRef}</p>
                  ) : null}
                  {deployment.note ? (
                    <p className="mt-2 text-[11px] leading-5 text-text-secondary">{deployment.note}</p>
                  ) : null}
                  {deployment.rollbackReason ? (
                    <p className="mt-2 text-[10px] text-warning">Rollback: {deployment.rollbackReason}</p>
                  ) : null}
                </div>
              </div>

              <DeploymentRollbackAction deployment={deployment} />
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
