import { ArrowRight, Bug, CheckCircle2, Download, FlaskConical, History, Rocket, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  buildTestingAreas,
  testingReadyCount,
  testingStatusLabel,
  testingStatusVariant,
} from '@/features/system-testing/domain';
import {
  releaseOutcomeLabel,
  releaseOutcomeVariant,
  releaseReadinessLabel,
  releaseReadinessVariant,
} from '@/features/system-testing/release-domain';
import { getReleaseReadiness, getReleaseTestRuns } from '@/features/system-testing/release-queries';
import { releaseGoLiveLabel } from '@/features/system-testing/release-controls-domain';
import { getReleaseDefects, getReleaseGoLiveStatus } from '@/features/system-testing/release-controls-queries';
import { ReleaseStartButton } from '@/features/system-testing/release-start-button';
import { getDepartmentTestingSnapshot } from '@/features/system-testing/queries';

export default async function SystemTestingPage() {
  await requireHodAccess();

  const [snapshot, readiness, runs, defects, goLive] = await Promise.all([
    getDepartmentTestingSnapshot(),
    getReleaseReadiness(),
    getReleaseTestRuns(8),
    getReleaseDefects(100),
    getReleaseGoLiveStatus(),
  ]);

  const areas = buildTestingAreas(snapshot);
  const ready = testingReadyCount(areas);
  const activeRun = runs.find((run) => run.status === 'in_progress') ?? null;
  const openDefects = defects.filter((defect) => defect.status !== 'closed').length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Release Candidate"
        title="System Testing Center"
        description="Automated readiness and controlled user-acceptance testing."
        icon={FlaskConical}
        context={
          <Badge variant={readiness.ready ? 'success' : 'danger'}>
            {readiness.ready
              ? 'Automated gate clear'
              : `${readiness.blockerCount} blocker${readiness.blockerCount === 1 ? '' : 's'}`}
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
              href="/testing/sign-off"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <Rocket className="size-3.5" aria-hidden="true" />
              Go-live
            </Link>
            <Link
              href="/testing/deployments"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <Rocket className="size-3.5" aria-hidden="true" />
              Deployments
            </Link>
            <Link
              href="/api/testing/release-evidence"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Evidence
            </Link>
            {activeRun ? (
              <Link
                href={`/testing/runs/${activeRun.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary-hover"
              >
                Continue UAT
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <ReleaseStartButton />
            )}
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Active period"
          value={snapshot.activePeriod?.name ?? 'None'}
          description="Testing context"
          icon={FlaskConical}
        />
        <MetricCard
          label="Module data"
          value={`${ready}/${areas.length}`}
          description="Ready to exercise"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Automated blockers"
          value={String(readiness.blockerCount)}
          description={`${readiness.warningCount} warning${readiness.warningCount === 1 ? '' : 's'}`}
          icon={ShieldCheck}
        />
        <MetricCard
          label="UAT runs"
          value={String(runs.length)}
          description={activeRun ? '1 currently active' : 'No active run'}
          icon={History}
        />
        <MetricCard
          label="Open defects"
          value={String(openDefects)}
          description={`${goLive.blockerDefects} block go-live`}
          icon={Bug}
        />
        <MetricCard
          label="Go-live"
          value={releaseGoLiveLabel(goLive)}
          description={goLive.activeSignoff ? 'Active approval' : `${goLive.reasons.length} gate issue${goLive.reasons.length === 1 ? '' : 's'}`}
          icon={Rocket}
          status={releaseGoLiveLabel(goLive)}
        />
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Automated release gate</h2>
              <p className="mt-0.5 text-[11px] text-text-muted">
                Current department production prerequisites.
              </p>
            </div>
            <Badge variant={readiness.ready ? 'success' : 'danger'}>
              {readiness.ready
                ? 'No blockers'
                : `${readiness.blockerCount} blocker${readiness.blockerCount === 1 ? '' : 's'}`}
            </Badge>
          </div>
        </div>

        <div className="divide-y divide-border">
          {readiness.checks.map((check) => (
            <Link
              key={check.checkKey}
              href={check.href}
              className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-surface-subtle/60"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={releaseReadinessVariant(check.status)}>
                    {releaseReadinessLabel(check.status)}
                  </Badge>
                  <span className="text-[10px] font-semibold text-text-muted">{check.area}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-text-primary">{check.title}</p>
                <p className="mt-0.5 text-[10px] leading-4 text-text-muted">{check.detail}</p>
              </div>
              <span className="shrink-0 text-[10px] font-semibold text-primary">Open</span>
            </Link>
          ))}
        </div>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Module test entry points</h2>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Ready to test means enough current data exists to exercise the workflow.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {areas.map((area) => (
            <article key={area.key} className="rounded-xl border border-border bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{area.title}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-text-muted">{area.description}</p>
                </div>
                <Badge variant={testingStatusVariant(area.status)}>
                  {testingStatusLabel(area.status)}
                </Badge>
              </div>

              <div className="mt-4 rounded-lg bg-surface-subtle px-3 py-2.5">
                <p className="text-xs font-semibold text-text-primary">{area.metric}</p>
                <p className="mt-0.5 text-[10px] text-text-muted">{area.detail}</p>
              </div>

              <Link
                href={area.href}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[10px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
              >
                Test module
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-text-primary">UAT history</h2>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Completed runs are immutable; repeat testing creates a new run.
          </p>
        </div>

        {runs.length === 0 ? (
          <div className="px-4 py-7 text-center text-xs text-text-muted">No UAT runs yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/testing/runs/${run.id}`}
                className="grid gap-2 px-4 py-3 transition hover:bg-surface-subtle/60 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto] sm:items-center sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-text-primary">
                    Suite {run.suiteVersion} · {run.academicPeriodName ?? 'No period'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-text-muted">{run.departmentName}</p>
                </div>
                <Badge variant={releaseOutcomeVariant(run.outcome)}>
                  {releaseOutcomeLabel(run.outcome)}
                </Badge>
                <p className="text-[10px] text-text-muted">
                  {run.startReadiness.blockerCount} start blocker
                  {run.startReadiness.blockerCount === 1 ? '' : 's'}
                </p>
                <span className="text-[10px] font-semibold text-primary">Open</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <section className="rounded-xl border border-institutional-accent-border bg-institutional-yellow/10 px-4 py-3">
        <p className="text-[11px] leading-5 text-text-secondary">
          Production sign-off requires a passed UAT run and a clean local release verification.
          Automated readiness alone is not a release approval.
        </p>
      </section>
    </div>
  );
}
