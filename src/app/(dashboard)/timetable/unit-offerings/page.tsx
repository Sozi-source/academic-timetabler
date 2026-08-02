import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Upload,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { getUnitOfferings } from '@/features/unit-offerings/queries';
import { UnitOfferingTable } from '@/features/unit-offerings/unit-offering-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Units on Offer',
  description:
    'Review semester-specific curriculum units, cohort eligibility and timetable readiness.',
};

export default async function UnitOfferingsPage() {
  const offerings = await getUnitOfferings();
  const included = offerings.filter((offering) => offering.selectionState === 'included');
  const excluded = offerings.filter((offering) => offering.selectionState === 'excluded');
  const schedulable = included.filter(
    (offering) =>
      offering.isTimetableEnabled &&
      (offering.status === 'draft' || offering.status === 'active') &&
      ['classroom', 'practical', 'project', 'other'].includes(offering.offeringType),
  );
  const weeklyMinutes = schedulable.reduce(
    (total, offering) =>
      total +
      (offering.weeklySessions ?? 0) *
        (offering.sessionDurationMinutes ?? 0),
    0,
  );
  const weeklyHours = weeklyMinutes / 60;
  const representedPeriods = new Set(
    offerings.map((offering) => offering.academicPeriodId),
  ).size;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Semester planning"
        title="Units on Offer"
        description="Review the exact programme units offered to each cohort for an Academic Period before trainer allocation and timetable generation."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {offerings.length === 1
                ? '1 semester offering'
                : `${offerings.length} semester offerings`}
            </Badge>
            <Badge variant="success" dot>
              {schedulable.length} schedulable
            </Badge>
          </div>
        }
        actions={
          <Link
            href="/timetable/unit-offerings/import"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <Upload className="size-4" aria-hidden="true" />
            Import Units on Offer
          </Link>
        }
      />

      <section
        aria-label="Units on Offer metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="All offerings"
          value={String(offerings.length)}
          description={`${representedPeriods} Academic Period${representedPeriods === 1 ? '' : 's'} represented`}
          icon={ClipboardList}
          status="Total"
        />
        <MetricCard
          label="Included"
          value={String(included.length)}
          description="Selected semester curriculum requirements"
          icon={CheckCircle2}
          status="Included"
        />
        <MetricCard
          label="Excluded"
          value={String(excluded.length)}
          description="Units deliberately removed from scheduling"
          icon={XCircle}
          status="Excluded"
        />
        <MetricCard
          label="Weekly contact hours"
          value={Number.isInteger(weeklyHours) ? String(weeklyHours) : weeklyHours.toFixed(1)}
          description={`${schedulable.length} schedulable offering${schedulable.length === 1 ? '' : 's'}`}
          icon={Clock3}
          status="Workload"
        />
      </section>

      {offerings.length === 0 ? (
        <section className="rounded-2xl border border-warning-border bg-warning-surface px-5 py-5">
          <div className="flex items-start gap-3">
            <CalendarCheck2
              className="mt-0.5 size-5 shrink-0 text-warning"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold text-text-primary">
                No Units on Offer registered
              </h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Download the semester template, enter or review your real programme units,
                then upload and confirm the workbook.
              </p>
              <Link
                href="/timetable/unit-offerings/import"
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <Upload className="size-4" aria-hidden="true" />
                Open import workflow
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section aria-labelledby="unit-offering-register-title" className="space-y-4">
          <div>
            <h2
              id="unit-offering-register-title"
              className="text-lg font-semibold text-text-primary"
            >
              Semester offering register
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Review the programme, cohort, Academic Period, inclusion decision and
              timetable readiness of every Unit on Offer.
            </p>
          </div>
          <UnitOfferingTable offerings={offerings} />
        </section>
      )}
    </div>
  );
}
