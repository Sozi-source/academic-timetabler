import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
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
  buildTestingAreas,
  testingReadyCount,
  testingStatusLabel,
  testingStatusVariant,
} from '@/features/system-testing/domain';
import {
  getDepartmentTestingSnapshot,
} from '@/features/system-testing/queries';

export default async function SystemTestingPage() {
  await requireHodAccess();

  const snapshot =
    await getDepartmentTestingSnapshot();

  const areas =
    buildTestingAreas(
      snapshot,
    );

  const ready =
    testingReadyCount(
      areas,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pre-production"
        title="System Testing Center"
        description="Launch end-to-end testing from current department data."
        icon={FlaskConical}
        context={
          <Badge
            variant={
              ready ===
              areas.length
                ? 'success'
                : 'warning'
            }
          >
            {
              ready
            } / {
              areas.length
            } ready
          </Badge>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active period"
          value={
            snapshot.activePeriod
              ?.name ??
            'None'
          }
          description="Testing context"
          icon={FlaskConical}
        />

        <MetricCard
          label="Active students"
          value={String(
            snapshot.students.active,
          )}
          description="Portal / registration test pool"
          icon={CheckCircle2}
        />

        <MetricCard
          label="Published classes"
          value={String(
            snapshot.timetable.publishedSessions,
          )}
          description="Timetable / attendance test pool"
          icon={CheckCircle2}
        />

        <MetricCard
          label="Student downloads"
          value={String(
            snapshot.documents.studentDownloads,
          )}
          description="Audited document downloads"
          icon={CheckCircle2}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {areas.map(
          (
            area,
          ) => (
            <article
              key={
                area.key
              }
              className="rounded-xl border border-border bg-white px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-text-primary">
                    {
                      area.title
                    }
                  </h2>

                  <p className="mt-1 text-[11px] leading-5 text-text-muted">
                    {
                      area.description
                    }
                  </p>
                </div>

                <Badge
                  variant={
                    testingStatusVariant(
                      area.status,
                    )
                  }
                >
                  {testingStatusLabel(
                    area.status,
                  )}
                </Badge>
              </div>

              <div className="mt-4 rounded-lg bg-surface-subtle px-3 py-2.5">
                <p className="text-xs font-semibold text-text-primary">
                  {
                    area.metric
                  }
                </p>

                <p className="mt-0.5 text-[10px] text-text-muted">
                  {
                    area.detail
                  }
                </p>
              </div>

              <Link
                href={
                  area.href
                }
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[10px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
              >
                Test module
                <ArrowRight
                  className="size-3"
                  aria-hidden="true"
                />
              </Link>
            </article>
          ),
        )}
      </section>

      <section className="rounded-xl border border-institutional-accent-border bg-institutional-yellow/10 px-4 py-3">
        <p className="text-[11px] leading-5 text-text-secondary">
          “Ready to test” means the module has enough
          current data to exercise its workflow. It is
          not a production certification; final security,
          regression and user-acceptance testing still apply.
        </p>
      </section>
    </div>
  );
}
