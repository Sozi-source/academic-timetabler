'use client';

import { CheckCircle2, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import type { UnitOffering } from './types';
import { approveUnitOfferingsAction, withdrawUnitOfferingAction } from './approval-actions';

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
  if (offering.approvalStatus === 'withdrawn' || offering.selectionState === 'excluded') {
    return 'Dropped';
  }
  if (!offering.isTimetableEnabled) return 'Disabled';
  if (offering.approvalStatus === 'approved') {
    return offering.status === 'active' ? 'Active' : 'In Timetable';
  }
  if (offering.approvalStatus === 'review_required') return 'Review required';
  if (offering.status === 'draft') return 'Draft';
  return titleCase(offering.status);
}

function stateClass(offering: UnitOffering) {
  const label = stateLabel(offering);

  if (label === 'Active' || label === 'In Timetable') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold';
  }

  if (label === 'Draft' || label === 'Review required') {
    return 'border-amber-200 bg-amber-50 text-amber-800 font-semibold';
  }

  if (label === 'Dropped' || label === 'Disabled') {
    return 'border-slate-200 bg-slate-100 text-slate-600 font-medium';
  }

  return 'border-border bg-surface-subtle text-text-secondary';
}

export function UnitOfferingTable({ offerings }: UnitOfferingTableProps) {
  const [search, setSearch] = useState('');
  const [programmeId, setProgrammeId] = useState('all');
  const [cohortId, setCohortId] = useState('all');
  const [state, setState] = useState<StateFilter>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

      const isDropped = offering.approvalStatus === 'withdrawn' || offering.selectionState === 'excluded';
      const isIncluded = offering.approvalStatus === 'approved' && offering.selectionState === 'included';

      const matchesState =
        state === 'all' ||
        (state === 'included' && isIncluded) ||
        (state === 'excluded' && isDropped) ||
        (state === 'draft' && (offering.status === 'draft' || offering.approvalStatus === 'review_required')) ||
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

  const visibleIds = useMemo(() => filtered.map((o) => o.id), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id)) && !allVisibleSelected;

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
    }
  }

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
            <option value="included">In Timetable (Included)</option>
            <option value="excluded">Dropped (Excluded)</option>
            <option value="draft">Pending Review / Draft</option>
            <option value="active">Active (Allocated)</option>
            <option value="disabled">Timetable Disabled</option>
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

      <form action={approveUnitOfferingsAction} className="space-y-3">
        <input
          type="hidden"
          name="reason"
          value="Dropped from cohort teaching plan for this academic period"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-text-primary">
              Timetable Selection:
            </span>
            {selectedIds.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                {selectedIds.length} unit{selectedIds.length === 1 ? '' : 's'} selected
              </span>
            ) : (
              <span className="text-xs text-text-muted">
                Use checkboxes to select units to include in or drop from the timetable.
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                Clear
              </Button>
            ) : null}
            <Button
              type="submit"
              formAction={withdrawUnitOfferingAction}
              size="sm"
              variant="outline"
              disabled={selectedIds.length === 0}
              className="border-rose-300 font-semibold text-rose-700 hover:bg-rose-50"
            >
              Drop from Timetable ({selectedIds.length})
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={selectedIds.length === 0}
              leadingIcon={<CheckCircle2 className="size-4" />}
              className="font-semibold"
            >
              Include in Timetable ({selectedIds.length})
            </Button>
          </div>
        </div>

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
                    <th className="w-[5%] px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someVisibleSelected;
                        }}
                        onChange={toggleSelectAll}
                        aria-label="Select all visible units"
                        className="size-3.5 cursor-pointer rounded border-white/40 bg-white/20 text-primary accent-institutional-yellow"
                      />
                    </th>
                    <th className="w-[29%] px-3 py-2">Unit</th>
                    <th className="w-[26%] px-3 py-2">Class</th>
                    <th className="w-[18%] px-3 py-2">Sessions</th>
                    <th className="w-[22%] px-3 py-2">Timetable Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {filtered.map((offering) => {
                    const programme = offering.cohort?.programme ?? offering.unit?.programme;
                    const isDropped = offering.approvalStatus === 'withdrawn' || offering.selectionState === 'excluded';
                    const isApproved = offering.approvalStatus === 'approved' && offering.selectionState === 'included';

                    return (
                      <tr key={offering.id} className="align-top transition hover:bg-surface-subtle/60">
                        <td className="px-3 py-3 text-center">
                          <input
                            name="offeringId"
                            value={offering.id}
                            type="checkbox"
                            checked={selectedIds.includes(offering.id)}
                            onChange={(event) =>
                              setSelectedIds((current) =>
                                event.target.checked
                                  ? [...current, offering.id]
                                  : current.filter((id) => id !== offering.id),
                              )
                            }
                            aria-label={`Select ${offering.unit?.name ?? 'unit'} for ${offering.cohort?.name ?? 'cohort'}`}
                            className="size-4 cursor-pointer rounded border-border-strong text-primary accent-primary"
                          />
                        </td>
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
                          {isApproved ? (
                            <div className="mt-1.5">
                              <button
                                form={`withdraw-${offering.id}`}
                                type="submit"
                                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                              >
                                Drop from timetable
                              </button>
                            </div>
                          ) : isDropped ? (
                            <div className="mt-1.5">
                              <button
                                form={`approve-${offering.id}`}
                                type="submit"
                                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                              >
                                Include in timetable
                              </button>
                            </div>
                          ) : (
                            <div className="mt-1.5 flex items-center gap-2">
                              <button
                                form={`approve-${offering.id}`}
                                type="submit"
                                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                              >
                                Approve
                              </button>
                              <span className="text-[10px] text-text-muted">·</span>
                              <button
                                form={`withdraw-${offering.id}`}
                                type="submit"
                                className="text-[11px] font-medium text-rose-600 hover:text-rose-800 hover:underline"
                              >
                                Drop
                              </button>
                            </div>
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
      </form>

      {/* Hidden single-action forms for instant 1-click row triggers */}
      <div className="hidden">
        {offerings.map((offering) => (
          <div key={offering.id}>
            <form id={`withdraw-${offering.id}`} action={withdrawUnitOfferingAction}>
              <input type="hidden" name="offeringId" value={offering.id} />
              <input type="hidden" name="reason" value="Dropped from cohort teaching plan for this academic period" />
            </form>
            <form id={`approve-${offering.id}`} action={approveUnitOfferingsAction}>
              <input type="hidden" name="offeringId" value={offering.id} />
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
