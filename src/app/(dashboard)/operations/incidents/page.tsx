import {
  AlertTriangle,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  formatProductionTime,
  incidentBlocksProduction,
  incidentSeverityLabel,
  incidentSeverityVariant,
  incidentStatusLabel,
  incidentStatusVariant,
} from '@/features/production-controls/domain';
import { IncidentActions } from '@/features/production-controls/incident-actions';
import { IncidentCreateForm } from '@/features/production-controls/incident-create-form';
import {
  getProductionIncidents,
  getReleaseDeployments,
} from '@/features/production-controls/queries';

export default async function ProductionIncidentsPage() {
  await requireHodAccess();

  const [incidents, deployments] = await Promise.all([
    getProductionIncidents(400),
    getReleaseDeployments(100),
  ]);

  const open = incidents.filter((item) => item.status !== 'closed').length;
  const blocking = incidents.filter(incidentBlocksProduction).length;
  const production = incidents.filter((item) => item.environment === 'production' && item.status !== 'closed').length;

  return (
    <div className="admin-screen space-y-5">
      <PageHeader
        eyebrow="Pilot & Production"
        title="Operational incidents"
        description="Post-release production and pilot incident tracking."
        icon={AlertTriangle}
        context={
          <Badge variant={blocking > 0 ? 'danger' : 'success'}>
            {blocking} production blocker{blocking === 1 ? '' : 's'}
          </Badge>
        }
        actions={
          <Link
            href="/operations/action-center"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Action Center
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Open" value={String(open)} description="All unresolved incidents" icon={AlertTriangle} />
        <MetricCard label="Blocking" value={String(blocking)} description="Critical / High active" icon={ShieldAlert} />
        <MetricCard label="Production" value={String(production)} description="Unresolved Production incidents" icon={AlertTriangle} />
      </section>

      <IncidentCreateForm deployments={deployments} />

      {incidents.length === 0 ? (
        <section className="rounded-xl border border-border bg-white px-4 py-8 text-center text-xs text-text-muted">
          No operational incidents logged.
        </section>
      ) : (
        <section className="space-y-3">
          {incidents.map((incident) => (
            <article key={incident.id} className="rounded-xl border border-border bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">INC-{incident.incidentNumber}</Badge>
                    <Badge variant="institutional">
                      {incident.environment === 'production' ? 'Production' : 'Pilot'}
                    </Badge>
                    <Badge variant={incidentSeverityVariant(incident.severity)}>
                      {incidentSeverityLabel(incident.severity)}
                    </Badge>
                    <Badge variant={incidentStatusVariant(incident.status)}>
                      {incidentStatusLabel(incident.status)}
                    </Badge>
                    {incident.deploymentVersionLabel ? (
                      <Badge variant="neutral">{incident.deploymentVersionLabel}</Badge>
                    ) : null}
                  </div>
                  <h2 className="mt-2 text-sm font-bold text-text-primary">{incident.title}</h2>
                  <p className="mt-1 text-[11px] leading-5 text-text-secondary">{incident.description}</p>
                  <p className="mt-1 text-[9px] text-text-muted">
                    Updated {formatProductionTime(incident.updatedAt)}
                    {incident.createdByName ? ` · ${incident.createdByName}` : ''}
                  </p>
                </div>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <IncidentActions incident={incident} />
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
