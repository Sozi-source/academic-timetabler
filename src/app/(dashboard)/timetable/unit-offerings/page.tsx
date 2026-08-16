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

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { SectionHeader } from '@/components/ui/section-header';
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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Semester planning"
        title="Units on Offer"
        description="Manage semester units."
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
          <Button asChild variant="outline">
            <Link href="/timetable/unit-offerings/import">
              <Upload className="size-4" aria-hidden="true" />
              Import Units on Offer
            </Link>
          </Button>
        }
      />

      <section
        aria-label="Units on Offer metrics"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
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
        <Alert variant="warning" icon={CalendarCheck2} title="No Units on Offer registered">
          <p>
            Download the semester template, enter or review your real programme units,
            then upload and confirm the workbook.
          </p>
          <Button asChild variant="primary" className="mt-3">
            <Link href="/timetable/unit-offerings/import">
              <Upload className="size-4" aria-hidden="true" />
              Open import workflow
            </Link>
          </Button>
        </Alert>
      ) : (
        <section aria-labelledby="unit-offering-register-title" className="space-y-3">
          <SectionHeader
            title="Semester offering register"
            description="Review the programme, cohort, Academic Period, inclusion decision and timetable readiness of every Unit on Offer."
          />
          <UnitOfferingTable offerings={offerings} />
        </section>
      )}
    </div>
  );
}
