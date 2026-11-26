import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CalendarCheck2,
  GitMerge,
  Upload,
} from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { getAcademicPeriods } from '@/features/academic-periods/queries';
import {
  isTimetableConfigurablePeriod,
  prioritizeActiveAcademicPeriods,
  resolveAcademicPeriodId,
} from '@/features/academic-periods/selection';
import {
  getCohortUnitEditorOptions,
  getUnitOfferingsByPeriod,
} from '@/features/unit-offerings/queries';
import { UnitOfferingTable } from '@/features/unit-offerings/unit-offering-table';
import { AddUnitPanel } from '@/features/unit-offerings/add-unit-panel';
import { combineMatchingUnitOfferingsAction } from '@/features/teaching-allocations/simple-allocation-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Units on Offer',
  description: 'Manage units offered for the active academic period.',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UnitOfferingsPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const allPeriods = await getAcademicPeriods();
  const selectablePeriods = prioritizeActiveAcademicPeriods(
    allPeriods.filter((period) => isTimetableConfigurablePeriod(period)),
  );
  const requestedPeriod =
    typeof query.period === 'string'
      ? query.period
      : typeof query.academicPeriodId === 'string'
        ? query.academicPeriodId
        : undefined;
  const selectedPeriodId = resolveAcademicPeriodId(selectablePeriods, requestedPeriod);
  const activePeriod =
    selectablePeriods.find((period) => period.id === selectedPeriodId) ?? null;

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
        backHref="/timetable"
        backLabel="Timetabling"
        context={
          activePeriod ? (
            <div className="flex items-center gap-2">
              <Badge variant="neutral">{activePeriod.code}</Badge>
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

            {activePeriod ? (
              <form action={combineMatchingUnitOfferingsAction}>
                <input type="hidden" name="academicPeriodId" value={activePeriod.id} />
                <input type="hidden" name="returnTo" value="/timetable/unit-offerings" />
                <Button type="submit" variant="outline" size="sm">
                  Combine shared units
                </Button>
              </form>
            ) : null}
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

      {query.autoMerged !== undefined && (
        <Alert variant="success" title="Shared classes checked">
          Combined {String(query.mergedUnits ?? '0')} unit(s) into {String(query.autoMerged)} shared group(s)
          {Number(query.mergeSkipped ?? 0) > 0 ? ` (${String(query.mergeSkipped)} skipped due to fixed-time or duration differences)` : ''}.
        </Alert>
      )}

      {/* Main content */}
      {selectablePeriods.length > 0 ? (
        <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-3">
          <label className="min-w-[240px] flex-1 space-y-1 text-xs font-semibold text-text-muted">
            Academic Period
            <Select name="period" defaultValue={selectedPeriodId} className="mt-1 h-9 text-sm">
              {selectablePeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.code} — {period.name} ({period.status === 'active' ? 'Active' : 'Planned'})
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="outline" size="sm">
            Load period
          </Button>
        </form>
      ) : null}

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
            <UnitOfferingTable offerings={activeUnits} academicPeriodId={activePeriod.id} />
          )}
        </>
      )}
    </div>
  );
}