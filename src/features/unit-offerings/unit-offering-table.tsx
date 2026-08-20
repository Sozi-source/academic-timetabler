'use client';

import { RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import type { UnitOffering } from './types';

interface UnitOfferingTableProps {
  offerings: UnitOffering[];
}

type StateFilter =
  | 'all'
  | 'included'
  | 'excluded'
  | 'draft'
  | 'active'
  | 'disabled';

function normalize(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function stateLabel(offering: UnitOffering) {
  if (offering.selectionState === 'excluded') return 'Excluded';
  if (!offering.isTimetableEnabled) return 'Disabled';
  if (offering.status === 'draft') return 'Draft';
  if (offering.status === 'active') return 'Active';
  return titleCase(offering.status);
}

function stateClass(offering: UnitOffering) {
  const label = stateLabel(offering);

  if (label === 'Active') {
    return 'border-success/20 bg-success-subtle text-success';
  }

  if (label === 'Draft') {
    return 'border-warning/20 bg-warning-subtle text-warning';
  }

  if (label === 'Excluded' || label === 'Disabled') {
    return 'border-border bg-surface-subtle text-text-muted';
  }

  return 'border-border bg-surface-subtle text-text-secondary';
}

export function UnitOfferingTable({ offerings }: UnitOfferingTableProps) {
  const [search, setSearch] = useState('');
  const [programmeId, setProgrammeId] = useState('all');
  const [cohortId, setCohortId] = useState('all');
  const [state, setState] = useState<StateFilter>('all');

  const programmes = useMemo(() => {
    const values = new Map<string, string>();

    for (const offering of offerings) {
      const programme = offering.cohort?.programme ?? offering.unit?.programme;
      if (programme) values.set(programme.id, programme.name);
    }

    return [...values.entries()].sort((first, second) =>
      first[1].localeCompare(second[1]),
    );
  }, [offerings]);

  const cohorts = useMemo(() => {
    const values = new Map<string, { name: string; programmeId: string }>();

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
        ].some((value) => normalize(value).includes(query));

      const matchesState =
        state === 'all' ||
        (state === 'included' && offering.selectionState === 'included') ||
        (state === 'excluded' && offering.selectionState === 'excluded') ||
        (state === 'draft' && offering.status === 'draft') ||
        (state === 'active' && offering.status === 'active') ||
        (state === 'disabled' && !offering.isTimetableEnabled);

      return (
        matchesSearch &&
        (programmeId === 'all' || programme?.id === programmeId) &&
        (cohortId === 'all' || offering.cohortId === cohortId) &&
        matchesState
      );
    });
  }, [cohortId, offerings, programmeId, search, state]);

  const filtersActive =
    Boolean(search) ||
    programmeId !== 'all' ||
    cohortId !== 'all' ||
    state !== 'all';

  function clearFilters() {
    setSearch('');
    setProgrammeId('all');
    setCohortId('all');
    setState('all');
  }

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_12rem_12rem_10rem_auto]">
          <label className="relative min-w-0">
            <span className="sr-only">Search units</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search units"
              className="h-9 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-[12px] text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 xl:text-sm"
            />
          </label>

          <Select
            aria-label="Filter by programme"
            value={programmeId}
            onChange={(event) => {
              setProgrammeId(event.target.value);
              setCohortId('all');
            }}
            className="h-9 w-full text-[12px] xl:text-sm"
          >
            <option value="all">All programmes</option>
            {programmes.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </Select>

          <Select
            aria-label="Filter by cohort"
            value={cohortId}
            onChange={(event) => setCohortId(event.target.value)}
            className="h-9 w-full text-[12px] xl:text-sm"
          >
            <option value="all">All cohorts</option>
            {cohorts.map(([id, cohort]) => (
              <option key={id} value={id}>{cohort.name}</option>
            ))}
          </Select>

          <Select
            aria-label="Filter by state"
            value={state}
            onChange={(event) => setState(event.target.value as StateFilter)}
            className="h-9 w-full text-[12px] xl:text-sm"
          >
            <option value="all">All states</option>
            <option value="included">Included</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="disabled">Disabled</option>
            <option value="excluded">Excluded</option>
          </Select>

          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leadingIcon={<RotateCcw className="size-3.5" aria-hidden="true" />}
              onClick={clearFilters}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <p className="mt-2 text-[11px] text-text-muted xl:text-xs">
          {filtered.length} of {offerings.length} units
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-semibold text-text-primary">No matching units</p>
            <p className="mt-1 text-xs text-text-muted">Adjust the filters.</p>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="border-t-[3px] border-institutional-yellow bg-primary text-[10px] uppercase tracking-wide text-white/85 xl:text-xs">
                <tr>
                  <th className="w-[34%] px-3 py-2">Unit</th>
                  <th className="w-[31%] px-3 py-2">Class</th>
                  <th className="w-[20%] px-3 py-2">Sessions</th>
                  <th className="w-[15%] px-3 py-2">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {filtered.map((offering) => {
                  const programme = offering.cohort?.programme ?? offering.unit?.programme;

                  return (
                    <tr key={offering.id} className="align-top transition hover:bg-surface-subtle/60">
                      <td className="px-3 py-2.5">
                        <p className="break-words text-[12px] font-semibold leading-5 text-text-primary xl:text-sm">
                          {offering.unit?.name ?? '—'}
                        </p>
                        <p className="mt-0.5 text-[10px] text-text-muted xl:text-xs">
                          {offering.unit?.code ?? '—'} · {titleCase(offering.offeringType)}
                        </p>
                      </td>

                      <td className="px-3 py-2.5">
                        <p className="break-words text-[12px] font-medium leading-5 text-text-primary xl:text-sm">
                          {offering.cohort?.name ?? '—'}
                        </p>
                        <p className="mt-0.5 break-words text-[10px] text-text-muted xl:text-xs">
                          {programme?.shortName ?? programme?.name ?? '—'}
                        </p>
                      </td>

                      <td className="px-3 py-2.5 text-[12px] text-text-secondary xl:text-sm">
                        <p>
                          {offering.weeklySessions ?? '—'} × {offering.sessionDurationMinutes ?? '—'} min
                        </p>
                      </td>

                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold xl:text-xs ${stateClass(offering)}`}>
                          {stateLabel(offering)}
                        </span>
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
