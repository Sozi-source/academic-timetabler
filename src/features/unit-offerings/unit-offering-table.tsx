'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { UnitOffering } from './types';

interface UnitOfferingTableProps {
  offerings: UnitOffering[];
}

type SelectionFilter = 'all' | 'included' | 'excluded';
type TimetableFilter = 'all' | 'enabled' | 'disabled';

function normalize(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function selectionClass(value: string) {
  return value === 'included'
    ? 'border-success/20 bg-success-subtle text-success'
    : 'border-danger/20 bg-danger-subtle text-danger';
}

function statusClass(value: string) {
  if (value === 'active') {
    return 'border-success/20 bg-success-subtle text-success';
  }

  if (value === 'draft') {
    return 'border-warning/20 bg-warning-subtle text-warning';
  }

  if (value === 'cancelled') {
    return 'border-danger/20 bg-danger-subtle text-danger';
  }

  return 'border-border bg-surface-subtle text-text-muted';
}

function originClass(value: string) {
  if (value === 'curriculum') {
    return 'border-primary/20 bg-primary-subtle text-primary';
  }

  if (value === 'import') {
    return 'border-success/20 bg-success-subtle text-success';
  }

  if (value === 'special') {
    return 'border-warning/20 bg-warning-subtle text-warning';
  }

  return 'border-border bg-surface-subtle text-text-muted';
}

export function UnitOfferingTable({ offerings }: UnitOfferingTableProps) {
  const [search, setSearch] = useState('');
  const [periodId, setPeriodId] = useState('all');
  const [programmeId, setProgrammeId] = useState('all');
  const [cohortId, setCohortId] = useState('all');
  const [selection, setSelection] = useState<SelectionFilter>('all');
  const [timetable, setTimetable] = useState<TimetableFilter>('all');

  const periods = useMemo(() => {
    const values = new Map<string, string>();

    for (const offering of offerings) {
      if (offering.academicPeriod) {
        values.set(offering.academicPeriod.id, offering.academicPeriod.name);
      }
    }

    return [...values.entries()].sort((first, second) =>
      first[1].localeCompare(second[1]),
    );
  }, [offerings]);

  const programmes = useMemo(() => {
    const values = new Map<string, string>();

    for (const offering of offerings) {
      const programme = offering.cohort?.programme ?? offering.unit?.programme;

      if (programme) {
        values.set(programme.id, programme.name);
      }
    }

    return [...values.entries()].sort((first, second) =>
      first[1].localeCompare(second[1]),
    );
  }, [offerings]);

  const cohorts = useMemo(() => {
    const values = new Map<
      string,
      { name: string; programmeId: string }
    >();

    for (const offering of offerings) {
      if (offering.cohort) {
        values.set(offering.cohort.id, {
          name: offering.cohort.name,
          programmeId: offering.cohort.programmeId,
        });
      }
    }

    return [...values.entries()]
      .filter(([, cohort]) =>
        programmeId === 'all' ? true : cohort.programmeId === programmeId,
      )
      .sort((first, second) => first[1].name.localeCompare(second[1].name));
  }, [offerings, programmeId]);

  const filtered = useMemo(() => {
    const query = normalize(search);

    return offerings.filter((offering) => {
      const programme = offering.cohort?.programme ?? offering.unit?.programme;
      const matchesSearch =
        !query ||
        [
          offering.unit?.name,
          offering.unit?.code,
          offering.cohort?.name,
          offering.cohort?.code,
          programme?.name,
          programme?.code,
          offering.academicPeriod?.name,
          offering.academicPeriod?.code,
          offering.offeringType,
          offering.status,
          offering.origin,
        ].some((value) => normalize(value).includes(query));

      return (
        matchesSearch &&
        (periodId === 'all' || offering.academicPeriodId === periodId) &&
        (programmeId === 'all' || programme?.id === programmeId) &&
        (cohortId === 'all' || offering.cohortId === cohortId) &&
        (selection === 'all' || offering.selectionState === selection) &&
        (timetable === 'all' ||
          (timetable === 'enabled'
            ? offering.isTimetableEnabled
            : !offering.isTimetableEnabled))
      );
    });
  }, [cohortId, offerings, periodId, programmeId, search, selection, timetable]);

  function clearFilters() {
    setSearch('');
    setPeriodId('all');
    setProgrammeId('all');
    setCohortId('all');
    setSelection('all');
    setTimetable('all');
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-text-muted" aria-hidden="true" />
          <h2 className="font-semibold text-text-primary">Filter register</h2>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative xl:col-span-2">
            <span className="sr-only">Search Units on Offer</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search unit, cohort or programme"
              className="h-11 w-full rounded-xl border border-border-strong bg-surface pl-10 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <select
            aria-label="Filter by Academic Period"
            value={periodId}
            onChange={(event) => setPeriodId(event.target.value)}
            className="h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Academic Periods</option>
            {periods.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          <select
            aria-label="Filter by programme"
            value={programmeId}
            onChange={(event) => {
              setProgrammeId(event.target.value);
              setCohortId('all');
            }}
            className="h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All programmes</option>
            {programmes.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          <select
            aria-label="Filter by cohort"
            value={cohortId}
            onChange={(event) => setCohortId(event.target.value)}
            className="h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All cohorts</option>
            {cohorts.map(([id, cohort]) => (
              <option key={id} value={id}>{cohort.name}</option>
            ))}
          </select>

          <select
            aria-label="Filter by inclusion"
            value={selection}
            onChange={(event) => setSelection(event.target.value as SelectionFilter)}
            className="h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Included and excluded</option>
            <option value="included">Included only</option>
            <option value="excluded">Excluded only</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <select
            aria-label="Filter by timetable availability"
            value={timetable}
            onChange={(event) => setTimetable(event.target.value as TimetableFilter)}
            className="h-10 rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All timetable states</option>
            <option value="enabled">Timetable enabled</option>
            <option value="disabled">Timetable disabled</option>
          </select>

          <div className="flex items-center gap-3">
            <p className="text-sm text-text-muted">
              Showing <span className="font-semibold text-text-secondary">{filtered.length}</span>{' '}
              of <span className="font-semibold text-text-secondary">{offerings.length}</span>
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="h-10 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold text-text-primary">No Units on Offer found</p>
            <p className="mt-2 text-sm text-text-muted">
              Adjust the filters or import the semester Units on Offer.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
              <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-3 py-2.5">Academic Period</th>
                  <th className="px-3 py-2.5">Programme and cohort</th>
                  <th className="px-3 py-2.5">Unit</th>
                  <th className="px-3 py-2.5">Delivery</th>
                  <th className="px-3 py-2.5">Sessions</th>
                  <th className="px-3 py-2.5">Selection</th>
                  <th className="px-3 py-2.5">Timetable</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Origin</th>
                  <th className="px-3 py-2.5">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((offering) => {
                  const programme = offering.cohort?.programme ?? offering.unit?.programme;

                  return (
                    <tr key={offering.id} className="align-top transition hover:bg-surface-subtle/60">
                      <td className="px-4 py-4">
                        <p className="font-medium text-text-primary">{offering.academicPeriod?.name ?? '—'}</p>
                        <p className="mt-1 font-mono text-xs text-text-muted">{offering.academicPeriod?.code ?? '—'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-text-primary">{programme?.name ?? '—'}</p>
                        <p className="mt-1 text-xs text-text-muted">{offering.cohort?.name ?? '—'}</p>
                        {offering.cohort?.currentAcademicPeriodNumber ? (
                          <p className="mt-1 text-xs text-text-muted">
                            Current stage {offering.cohort.currentAcademicPeriodNumber}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-text-primary">{offering.unit?.name ?? '—'}</p>
                        <p className="mt-1 font-mono text-xs text-text-muted">{offering.unit?.code ?? '—'}</p>
                        {offering.recommendedStageNumber ? (
                          <p className="mt-1 text-xs text-text-muted">
                            Recommended stage {offering.recommendedStageNumber}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-text-secondary">
                          {titleCase(offering.offeringType)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-text-secondary">
                        <p>{offering.weeklySessions ?? '—'} per week</p>
                        <p className="mt-1 text-xs text-text-muted">
                          {offering.sessionDurationMinutes ?? '—'} minutes
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${selectionClass(offering.selectionState)}`}>
                          {offering.selectionState}
                        </span>
                        {offering.exceptionReason ? (
                          <p className="mt-2 max-w-48 text-xs leading-5 text-text-muted">{offering.exceptionReason}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <span className={offering.isTimetableEnabled ? 'font-semibold text-success' : 'text-text-muted'}>
                          {offering.isTimetableEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(offering.status)}`}>
                          {offering.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${originClass(offering.origin)}`}>
                          {offering.origin}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {offering.manuallyReviewed ? (
                          <div>
                            <p className="font-semibold text-warning">Manually reviewed</p>
                            {offering.reviewedAt ? (
                              <p className="mt-1 text-xs text-text-muted">
                                {new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(
                                  new Date(offering.reviewedAt),
                                )}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-text-muted">Not reviewed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
