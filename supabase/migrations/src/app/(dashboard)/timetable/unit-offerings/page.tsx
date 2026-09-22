import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarCheck2,
  GitMerge,
  Upload,
  Plus,
} from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { getActiveAcademicPeriod } from '@/features/academic-periods/queries';
import {
  getCohortUnitEditorOptions,
  getUnitOfferingsByPeriod,
} from '@/features/unit-offerings/queries';
import { UnitOfferingTable } from '@/features/unit-offerings/unit-offering-table';
import { AddUnitPanel } from '@/features/unit-offerings/add-unit-panel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Units on Offer',
  description: 'Manage units offered for the active academic period.',
};

export default async function UnitOfferingsPage({
  searchParams,
}: PageProps<'/timetable/unit-offerings'>) {
  const query = await searchParams;
  const activePeriod = await getActiveAcademicPeriod();

  const [activeUnits, editorOptions] = activePeriod
    ? await Promise.all([
        getUnitOfferingsByPeriod(activePeriod.id),
        getCohortUnitEditorOptions(),
      ])
    : [[], { cohorts: [], units: [] }];

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Units on Offer"
        context={
          activePeriod ? (
            <div className="flex items-center gap-2">
              <Badge variant="neutral">{activePeriod.name}</Badge>
              <span className="text-xs font-medium text-text-muted">
                {activeUnits.length} units
              </span>
            </div>
          ) : (
            <Badge variant="warning">No active period</Badge>
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/unit-equivalence">
                <GitMerge className="size-4" />
                Equivalence
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/units">Curriculum</Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/unit-offerings/import">
                <Upload className="size-4" />
                Import
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        }
      />

      {/* Feedback */}
      {query.approvalError && (
        <Alert variant="danger" title="Authorization failed">
          {String(query.approvalError)}
        </Alert>
      )}

      {query.approvalWarning && (
        <Alert variant="warning" title="Notice">
          {String(query.approvalWarning)}
        </Alert>
      )}

      {query.approved && (
        <Alert variant="success" title="Added to timetable">
          {String(query.approved)} offering(s) are ready for teaching
          allocation and timetable generation.
        </Alert>
      )}

      {query.withdrawn && (
        <Alert variant="success" title="Removed from timetable">
          {String(query.withdrawn)} offering(s) removed.
        </Alert>
      )}

      {query.added && (
        <Alert variant="success" title="Unit added">
          Review the unit below before including it in the timetable.
        </Alert>
      )}

      {/* Main content */}
      {!activePeriod ? (
        <Alert
          variant="warning"
          icon={CalendarCheck2}
          title="No active academic period"
        >
          Activate an academic period to manage units.
        </Alert>
      ) : (
        <>
          {/* Add unit */}
          <AddUnitPanel
          academicPeriodId={activePeriod.id}
          cohorts={editorOptions.cohorts}
          units={editorOptions.units}
          existingPairs={activeUnits.map(
            (offering) => `${offering.cohortId}:${offering.unitId}`
          )}
        />

          {/* Units */}
          {activeUnits.length === 0 ? (
            <Alert
              variant="warning"
              icon={CalendarCheck2}
              title="No units found"
            >
              Import or add units for {activePeriod.name}.
            </Alert>
          ) : (
            <UnitOfferingTable offerings={activeUnits} />
          )}
        </>
      )}
    </div>
  );
}