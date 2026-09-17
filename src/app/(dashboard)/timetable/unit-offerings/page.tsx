import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CalendarCheck2, GitMerge, Upload } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { getActiveAcademicPeriod } from '@/features/academic-periods/queries';
import { getCohortUnitEditorOptions, getUnitOfferingsByPeriod } from '@/features/unit-offerings/queries';
import { UnitOfferingTable } from '@/features/unit-offerings/unit-offering-table';
import { CohortUnitEditor } from '@/features/unit-offerings/cohort-unit-editor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Units on Offer',
  description: 'Review units for the active academic period.',
};

export default async function UnitOfferingsPage({ searchParams }: PageProps<'/timetable/unit-offerings'>) {
  const query = await searchParams;
  const activePeriod = await getActiveAcademicPeriod();
  const [activeUnits, editorOptions] = activePeriod
    ? await Promise.all([getUnitOfferingsByPeriod(activePeriod.id), getCohortUnitEditorOptions()])
    : [[], { cohorts: [], units: [] }];

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
              <Link href="/timetable/unit-equivalence">
                <GitMerge className="size-4" aria-hidden="true" />
                Unit equivalence
              </Link>
            </Button>
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

      {query.approvalError ? <Alert variant="danger" title="Offering authorization failed">{String(query.approvalError)}</Alert> : null}
      {query.approved ? (
        <Alert variant="success" title="Cohort offering(s) included in timetable">
          {String(query.approved)} offering(s) included and ready for teaching allocations and timetable generation.
        </Alert>
      ) : null}
      {query.withdrawn ? (
        <Alert variant="success" title="Cohort offering(s) dropped from timetable">
          {String(query.withdrawn)} offering(s) dropped. They will not be picked by the timetabler or teaching allocations.
        </Alert>
      ) : null}
      {query.added ? <Alert variant="success" title="Unit added for review">Approve or include it below when you are satisfied that it belongs in the cohort teaching plan.</Alert> : null}

      {!activePeriod ? (
        <Alert
          variant="warning"
          icon={CalendarCheck2}
          title="No active academic period"
        >
          Activate the current academic period before managing units.
        </Alert>
      ) : (
        <>
          <CohortUnitEditor academicPeriodId={activePeriod.id} cohorts={editorOptions.cohorts} units={editorOptions.units} existingPairs={activeUnits.map((offering) => `${offering.cohortId}:${offering.unitId}`)} />
      {activeUnits.length === 0 ? (
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
        </>
      )}
    </div>
  );
}
