'use client';

import { useMemo, useState } from 'react';
import { BookPlus, Info, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { addCohortUnitOfferingAction } from './approval-actions';

interface CohortOption {
  id: string;
  name: string;
  code: string;
  programmeId: string;
  programmeName: string;
  currentStage: number;
}

interface UnitOption {
  id: string;
  code: string;
  name: string;
  programmeId: string | null;
  programmeName?: string | null;
  stage: number | null;
}

const REASON_PRESETS = [
  'Missed clinical rotation',
  'Retake / repeat unit',
  'Deferred unit',
  'Elective unit',
  'Special curriculum arrangement',
];

export function CohortUnitEditor({
  academicPeriodId,
  cohorts,
  units,
  existingPairs,
}: {
  academicPeriodId: string;
  cohorts: CohortOption[];
  units: UnitOption[];
  existingPairs: string[];
}) {
  const [cohortId, setCohortId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [stageFilter, setStageFilter] = useState<'current' | 'all' | 'unassigned' | string>('all');
  const [showAllProgrammes, setShowAllProgrammes] = useState(false);
  const [reason, setReason] = useState('');

  const cohort = cohorts.find((item) => item.id === cohortId);
  const existing = useMemo(() => new Set(existingPairs), [existingPairs]);

  // Find all available units for the selected cohort
  const programmeUnits = useMemo(() => {
    if (!cohort) return [];
    return units
      .filter((unit) => {
        const matchesProgramme = showAllProgrammes || !unit.programmeId || unit.programmeId === cohort.programmeId;
        const alreadyOffered = existing.has(`${cohortId}:${unit.id}`);
        return matchesProgramme && !alreadyOffered;
      })
      .sort((a, b) => {
        const stageA = a.stage && a.stage > 0 ? a.stage : 999;
        const stageB = b.stage && b.stage > 0 ? b.stage : 999;
        return stageA - stageB || a.code.localeCompare(b.code);
      });
  }, [cohort, units, existing, cohortId, showAllProgrammes]);

  // Filter available units based on stage filter
  const availableUnits = useMemo(() => {
    if (!cohort) return [];
    if (stageFilter === 'current') {
      return programmeUnits.filter((unit) => unit.stage === cohort.currentStage || !unit.stage || unit.stage <= 0);
    }
    if (stageFilter === 'unassigned') {
      return programmeUnits.filter((unit) => !unit.stage || unit.stage <= 0);
    }
    if (stageFilter === 'all') {
      return programmeUnits;
    }
    const targetStage = Number(stageFilter);
    if (!Number.isNaN(targetStage)) {
      return programmeUnits.filter((unit) => unit.stage === targetStage);
    }
    return programmeUnits;
  }, [cohort, programmeUnits, stageFilter]);

  // Group available units into staged groups and unassigned/general group
  const { stagedGroups, unassignedUnits } = useMemo(() => {
    const groups = new Map<number, UnitOption[]>();
    const unassigned: UnitOption[] = [];

    for (const unit of availableUnits) {
      if (unit.stage && unit.stage > 0) {
        const list = groups.get(unit.stage) ?? [];
        list.push(unit);
        groups.set(unit.stage, list);
      } else {
        unassigned.push(unit);
      }
    }

    const sortedGroups = Array.from(groups.entries()).sort(([stageA], [stageB]) => stageA - stageB);
    return { stagedGroups: sortedGroups, unassignedUnits: unassigned };
  }, [availableUnits]);

  // Available stage numbers in this list
  const availableStages = useMemo(() => {
    const stageSet = new Set<number>();
    for (const unit of programmeUnits) {
      if (unit.stage && unit.stage > 0) {
        stageSet.add(unit.stage);
      }
    }
    return Array.from(stageSet).sort((a, b) => a - b);
  }, [programmeUnits]);

  const selectedUnit = units.find((u) => u.id === unitId);
  const isCrossStage = Boolean(
    cohort &&
      selectedUnit &&
      selectedUnit.stage &&
      selectedUnit.stage > 0 &&
      selectedUnit.stage !== cohort.currentStage,
  );
  const isCrossProgramme = Boolean(
    cohort &&
      selectedUnit &&
      selectedUnit.programmeId &&
      selectedUnit.programmeId !== cohort.programmeId,
  );

  return (
    <form action={addCohortUnitOfferingAction} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <input type="hidden" name="academicPeriodId" value={academicPeriodId} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <BookPlus className="size-4 text-primary" aria-hidden="true" />
            <p className="font-semibold text-text-primary text-sm sm:text-base">
              Add a unit to a cohort
            </p>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            Add standard stage units, missed clinical rotations, retakes, or electives to any cohort.
          </p>
        </div>
        {cohort ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-subtle px-2.5 py-0.5 text-xs font-medium text-primary">
            <span>{cohort.code}</span>
            <span>·</span>
            <span>Current Stage: {cohort.currentStage}</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.9fr_1.2fr_1.2fr_auto]">
        {/* Cohort selector */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            1. Select cohort
          </label>
          <Select
            name="cohortId"
            required
            value={cohortId}
            onChange={(event) => {
              setCohortId(event.target.value);
              setUnitId('');
              setStageFilter('all');
            }}
            aria-label="Cohort"
          >
            <option value="">Choose cohort…</option>
            {cohorts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.programmeName} (Stage {item.currentStage})
              </option>
            ))}
          </Select>
        </div>

        {/* Stage filter */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            2. Stage filter
          </label>
          <Select
            disabled={!cohortId}
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setUnitId('');
            }}
            aria-label="Filter units by stage"
          >
            <option value="all">All Stages (including unassigned / general)</option>
            {cohort ? (
              <option value="current">Current Stage only (Stage {cohort.currentStage})</option>
            ) : null}
            {availableStages.map((stage) => (
              <option key={stage} value={String(stage)}>
                Stage {stage} {cohort && stage === cohort.currentStage ? '(Current)' : ''}
              </option>
            ))}
            {unassignedUnits.length > 0 ? (
              <option value="unassigned">General / Unassigned Stage only</option>
            ) : null}
          </Select>
        </div>

        {/* Unit selector */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            3. Select unit
          </label>
          <Select
            name="unitId"
            required
            disabled={!cohortId || availableUnits.length === 0}
            aria-label="Programme unit"
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
          >
            <option value="">
              {!cohortId
                ? 'Select a cohort first'
                : availableUnits.length === 0
                  ? 'No units available for this filter'
                  : 'Choose unit…'}
            </option>

            {/* Unassigned / general stage units (e.g. Clinical Rotation if not grouped in a stage) */}
            {unassignedUnits.length > 0 ? (
              <optgroup label="General / Unassigned Stage (Available to all stages)">
                {unassignedUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} — {unit.name} · General / All stages
                    {unit.programmeName ? ` (${unit.programmeName})` : ''}
                  </option>
                ))}
              </optgroup>
            ) : null}

            {/* Staged units */}
            {stagedGroups.map(([stage, stageUnits]) => (
              <optgroup
                key={stage}
                label={`Stage ${stage}${cohort && stage === cohort.currentStage ? ' (Current Stage)' : ' (Other / Previous Stage)'}`}
              >
                {stageUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} — {unit.name} · Stage {unit.stage}
                    {cohort && unit.stage !== cohort.currentStage ? ' (Cross-stage)' : ''}
                    {unit.programmeName && unit.programmeId !== cohort?.programmeId
                      ? ` (${unit.programmeName})`
                      : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {/* Reason input */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            4. Reason for addition
          </label>
          <Input
            name="reason"
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Missed clinical rotation, repeat…"
            aria-label="Reason for adding unit"
          />
        </div>

        {/* Submit button */}
        <div className="flex items-end">
          <Button
            type="submit"
            disabled={!cohortId || !unitId || reason.trim().length < 3}
            leadingIcon={<Plus className="size-4" />}
            className="w-full sm:w-auto"
          >
            Add for review
          </Button>
        </div>
      </div>

      {/* Preset reason chips & cross-programme toggle */}
      {cohortId ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-muted font-medium">Quick reasons:</span>
            {REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className="inline-flex items-center rounded-md border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary hover:border-primary/40 hover:bg-primary-subtle hover:text-primary transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-text-secondary hover:text-text-primary">
            <input
              type="checkbox"
              checked={showAllProgrammes}
              onChange={(e) => {
                setShowAllProgrammes(e.target.checked);
                setUnitId('');
              }}
              className="rounded border-border"
            />
            <span>Include units from other department programmes</span>
          </label>
        </div>
      ) : null}

      {/* Cross-stage or Cross-programme informative alert */}
      {isCrossStage || isCrossProgramme || (selectedUnit && (!selectedUnit.stage || selectedUnit.stage <= 0)) ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-subtle p-2.5 text-xs text-warning-strong">
          <Info className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-semibold">Unit Selection: </span>
            <span>
              You are adding <strong>{selectedUnit?.code} ({selectedUnit?.name})</strong>
              {selectedUnit?.stage && selectedUnit.stage > 0
                ? ` from Stage ${selectedUnit.stage}`
                : ' (General / Unassigned stage)'}
              {selectedUnit?.programmeName ? ` [${selectedUnit.programmeName}]` : ''} to{' '}
              <strong>{cohort?.code}</strong> (Stage {cohort?.currentStage}).
            </span>
            <span className="block mt-0.5 text-text-muted">
              After clicking <strong>Add for review</strong>, approve it in the table below so it becomes available under Teaching Allocations.
            </span>
          </div>
        </div>
      ) : null}
    </form>
  );
}
