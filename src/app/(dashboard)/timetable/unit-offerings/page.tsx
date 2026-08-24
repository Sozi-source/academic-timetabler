import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CalendarCheck2, Upload } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { getActiveAcademicPeriod } from '@/features/academic-periods/queries';
import { getUnitOfferingsByPeriod } from '@/features/unit-offerings/queries';
import { UnitOfferingTable } from '@/features/unit-offerings/unit-offering-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Units on Offer',
  description: 'Review units for the active academic period.',
};

export default async function UnitOfferingsPage() {
  const activePeriod = await getActiveAcademicPeriod();
  const activeUnits = activePeriod
    ? await getUnitOfferingsByPeriod(activePeriod.id)
    : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Units on offer"
        context={
          <div className="flex flex-wrap items-center gap-2">
            {activePeriod ? (
              <>
                <Badge variant="neutral">{activePeriod.name}</Badge>
                <span className="text-xs font-medium text-text-muted xl:text-sm">
                  {activeUnits.length} unit{activeUnits.length === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              <Badge variant="warning">No active academic period</Badge>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/units">Curriculum Units</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/unit-offerings/import">
                <Upload className="size-4" aria-hidden="true" />
                Import
              </Link>
            </Button>
          </div>
        }
      />

      {!activePeriod ? (
        <Alert
          variant="warning"
          icon={CalendarCheck2}
          title="No active academic period"
        >
          Activate the current academic period before managing units.
        </Alert>
      ) : activeUnits.length === 0 ? (
        <Alert
          variant="warning"
          icon={CalendarCheck2}
          title="No units for the active period"
        >
          Import or generate units for {activePeriod.name}.
        </Alert>
      ) : (
        <UnitOfferingTable offerings={activeUnits} />
      )}
    </div>
  );
}
