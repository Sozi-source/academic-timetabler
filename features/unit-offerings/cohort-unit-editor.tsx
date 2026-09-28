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
  const [stageFilter, setStageFilter] = useState<
    'current' | 'all' | 'unassigned' | string
  >('all');
  const [showAllProgrammes, setShowAllProgrammes] = useState(false);
  const [reason, setReason] = useState('');

  const cohort = cohorts.find((item) => item.id === cohortId);

  const existing = useMemo(
    () => new Set(existingPairs),
    [existingPairs]
  );

  const programmeUnits = useMemo(() => {
    if (!cohort) return [];

    return units
      .filter((unit) => {
        const matchesProgramme =
          showAllProgrammes ||
          !unit.programmeId ||
          unit.programmeId === cohort.programmeId;

        const alreadyOffered = existing.has(`${cohortId}:${unit.id}`);

        return matchesProgramme && !alreadyOffered;
      })
      .sort((a, b) => {
        const stageA = a.stage && a.stage > 0 ? a.stage : 999;
        const stageB = b.stage && b.stage > 0 ? b.stage : 999;

        return stageA - stageB || a.code.localeCompare(b.code);
      });
  }, [cohort, units, existing, cohortId, showAllProgrammes]);

  const availableUnits = useMemo(() => {
    if (!cohort) return [];

    if (stageFilter === 'current') {
      return programmeUnits.filter(
        (unit) =>
          unit.stage === cohort.currentStage ||
          !unit.stage ||
          unit.stage <= 0
      );
    }

    if (stageFilter === 'unassigned') {
      return programmeUnits.filter(
        (unit) => !unit.stage || unit.stage <= 0
      );
    }

    if (stageFilter === 'all') {
      return programmeUnits;
    }

    const targetStage = Number(stageFilter);

    if (!Number.isNaN(targetStage)) {
      return programmeUnits.filter(
        (unit) => unit.stage === targetStage
      );
    }

    return programmeUnits;
  }, [cohort, programmeUnits, stageFilter]);

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

    const sortedGroups = Array.from(groups.entries()).sort(
      ([stageA], [stageB]) => stageA - stageB
    );

    return {
      stagedGroups: sortedGroups,
      unassignedUnits: unassigned,
    };
  }, [availableUnits]);

  const availableStages = useMemo(() => {
    const stageSet = new Set<number>();

    for (const unit of programmeUnits) {
      if (unit.stage && unit.stage > 0) {
        stageSet.add(unit.stage);
      }
    }

    return Array.from(stageSet).sort((a, b) => a - b);
  }, [programmeUnits]);

  const selectedUnit = units.find((unit) => unit.id === unitId);

  const isCrossStage = Boolean(
    cohort &&
      selectedUnit &&
      selectedUnit.stage &&
      selectedUnit.stage > 0 &&
      selectedUnit.stage !== cohort.currentStage
  );

  const isCrossProgramme = Boolean(
    cohort &&
      selectedUnit &&
      selectedUnit.programmeId &&
      selectedUnit.programmeId !== cohort.programmeId
  );

  const isUnassignedStage =
    Boolean(selectedUnit) &&
    (!selectedUnit?.stage || selectedUnit.stage <= 0);

  const showSelectionNotice =
    isCrossStage || isCrossProgramme || isUnassignedStage;

  return (
    <form
      action={addCohortUnitOfferingAction}
      className="rounded-2xl border border-border bg-surface p-3 shadow-sm"
    >
      <input
        type="hidden"
        name="academicPeriodId"
        value={academicPeriodId}
      />

      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookPlus
            className="size-4 text-primary"
            aria-hidden="true"
          />

          <p className="text-sm font-semibold text-text-primary">
            Add unit to cohort
          </p>
        </div>

        {cohort ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-subtle px-2.5 py-0.5 text-[11px] font-medium text-primary">
            <span>{cohort.code}</span>
            <span>·</span>
            <span>Stage {cohort.currentStage}</span>
          </div>
        ) : null}
      </div>

      {/* Form */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.9fr_1.2fr_1.2fr_auto]">
        {/* Cohort */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-text-secondary">
            Cohort
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
            className="text-xs"
          >
            <option value="">Choose cohort…</option>

            {cohorts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.programmeName} · Stage{' '}
                {item.currentStage}
              </option>
            ))}
          </Select>
        </div>

        {/* Stage */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-text-secondary">
            Stage
          </label>

          <Select
            disabled={!cohortId}
            value={stageFilter}
            onChange={(event) => {
              setStageFilter(event.target.value);
              setUnitId('');
            }}
            aria-label="Filter units by stage"
            className="text-xs"
          >
            <option value="all">All stages</option>

            {cohort ? (
              <option value="current">
                Current · Stage {cohort.currentStage}
              </option>
            ) : null}

            {availableStages.map((stage) => (
              <option key={stage} value={String(stage)}>
                Stage {stage}
                {cohort && stage === cohort.currentStage
                  ? ' · Current'
                  : ''}
              </option>
            ))}

            {unassignedUnits.length > 0 ? (
              <option value="unassigned">
                General / Unassigned
              </option>
            ) : null}
          </Select>
        </div>

        {/* Unit */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-text-secondary">
            Unit
          </label>

          <Select
            name="unitId"
            required
            disabled={!cohortId || availableUnits.length === 0}
            aria-label="Programme unit"
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
            className="text-xs"
          >
            <option value="">
              {!cohortId
                ? 'Select cohort first'
                : availableUnits.length === 0
                  ? 'No units available'
                  : 'Choose unit…'}
            </option>

            {unassignedUnits.length > 0 ? (
              <optgroup label="General / Unassigned">
                {unassignedUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} — {unit.name}
                    {unit.programmeName
                      ? ` · ${unit.programmeName}`
                      : ''}
                  </option>
                ))}
              </optgroup>
            ) : null}

            {stagedGroups.map(([stage, stageUnits]) => (
              <optgroup
                key={stage}
                label={`Stage ${stage}${
                  cohort && stage === cohort.currentStage
                    ? ' · Current'
                    : ''
                }`}
              >
                {stageUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} — {unit.name}
                    {cohort && unit.stage !== cohort.currentStage
                      ? ' · Cross-stage'
                      : ''}
                    {unit.programmeName &&
                    unit.programmeId !== cohort?.programmeId
                      ? ` · ${unit.programmeName}`
                      : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {/* Reason */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-text-secondary">
            Reason
          </label>

          <Input
            name="reason"
            required
            minLength={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Missed clinical rotation"
            aria-label="Reason for adding unit"
            className="text-xs placeholder:text-xs"
          />
        </div>

        {/* Submit */}
        <div className="flex items-end">
          <Button
            type="submit"
            disabled={
              !cohortId ||
              !unitId ||
              reason.trim().length < 3
            }
            leadingIcon={<Plus className="size-4" />}
            className="w-full text-xs sm:w-auto"
          >
            Add for review
          </Button>
        </div>
      </div>

      {/* Quick reasons */}
      {cohortId ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-text-muted">
              Quick reasons:
            </span>

            {REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className="inline-flex items-center rounded-md border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-primary/40 hover:bg-primary-subtle hover:text-primary"
              >
                {preset}
              </button>
            ))}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-text-secondary hover:text-text-primary">
            <input
              type="checkbox"
              checked={showAllProgrammes}
              onChange={(event) => {
                setShowAllProgrammes(event.target.checked);
                setUnitId('');
              }}
              className="rounded border-border"
            />

            <span>Other programmes</span>
          </label>
        </div>
      ) : null}

      {/* Selection notice */}
      {showSelectionNotice ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-subtle p-2.5 text-xs text-warning-strong">
          <Info
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />

          <div>
            <span className="font-semibold">
              Review required:
            </span>{' '}
            {selectedUnit?.code} is being added to {cohort?.code}
            {isCrossStage
              ? ` from Stage ${selectedUnit?.stage}`
              : ''}
            {isCrossProgramme ? ' from another programme' : ''}
            {isUnassignedStage ? ' as a general unit' : ''}.
          </div>
        </div>
      ) : null}
    </form>
  );
}