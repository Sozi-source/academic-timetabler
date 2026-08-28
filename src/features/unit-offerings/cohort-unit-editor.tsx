'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { addCohortUnitOfferingAction } from './approval-actions';

interface CohortOption { id: string; name: string; code: string; programmeId: string; programmeName: string; currentStage: number }
interface UnitOption { id: string; code: string; name: string; programmeId: string; stage: number }

export function CohortUnitEditor({ academicPeriodId, cohorts, units, existingPairs }: {
  academicPeriodId: string;
  cohorts: CohortOption[];
  units: UnitOption[];
  existingPairs: string[];
}) {
  const [cohortId, setCohortId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [allowCrossStage, setAllowCrossStage] = useState(false);
  const cohort = cohorts.find((item) => item.id === cohortId);
  const existing = useMemo(() => new Set(existingPairs), [existingPairs]);
  const availableUnits = units.filter((unit) => unit.programmeId === cohort?.programmeId
    && (allowCrossStage || unit.stage === cohort.currentStage)
    && !existing.has(`${cohortId}:${unit.id}`));

  return <form action={addCohortUnitOfferingAction} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
    <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
    <div className="mb-3"><p className="font-semibold text-text-primary">Add a unit to a cohort</p><p className="text-xs text-text-muted">Only the cohort&apos;s current-stage units are shown by default. Every addition returns to human approval.</p></div>
    <div className="grid gap-2 lg:grid-cols-[1fr_1fr_1.2fr_auto]">
      <Select name="cohortId" required value={cohortId} onChange={(event) => { setCohortId(event.target.value); setUnitId(''); setAllowCrossStage(false); }} aria-label="Cohort">
        <option value="">Select cohort</option>
        {cohorts.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.programmeName}</option>)}
      </Select>
      <Select name="unitId" required disabled={!cohortId} aria-label="Programme unit" value={unitId} onChange={(event) => setUnitId(event.target.value)}>
        <option value="">Select unit</option>
        {availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} — {unit.name} · Stage {unit.stage}</option>)}
      </Select>
      <Input name="reason" required minLength={3} placeholder="Reason: repeat, deferred, elective…" aria-label="Reason for adding unit" />
      <Button type="submit" disabled={!cohortId || !unitId} leadingIcon={<Plus className="size-4" />}>Add for review</Button>
    </div>
    {cohort ? (
      <label className="mt-3 flex items-start gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={allowCrossStage}
          onChange={(event) => { setAllowCrossStage(event.target.checked); setUnitId(''); }}
          className="mt-0.5"
        />
        <span>
          Add a repeat or deferred unit from another stage
          <span className="block text-text-muted">This is an exception for Stage {cohort.currentStage}; explain the reason and approve it separately.</span>
        </span>
      </label>
    ) : null}
  </form>;
}
