'use client';

import { useMemo, useState } from 'react';
import type { DepartmentRegistrationUnit, ProgrammeStageOption } from './types';

export function StageUnitPicker({
  stages,
  units,
  stageUnitIds,
  initialSelected,
}: {
  stages: ProgrammeStageOption[];
  units: DepartmentRegistrationUnit[];
  stageUnitIds: Record<string, string[]>;
  initialSelected: string[];
}) {
  const [stageId, setStageId] = useState(stages[0]?.id ?? '');
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const visibleUnits = useMemo(() => {
    const allowed = new Set(stageUnitIds[stageId] ?? []);
    return units.filter((unit) => allowed.has(unit.id));
  }, [stageId, stageUnitIds, units]);

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-text-secondary">
        Registration stage
        <select value={stageId} onChange={(event) => setStageId(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-border bg-white px-3 text-sm" required>
          <option value="" disabled>Select a stage</option>
          {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
        </select>
      </label>
      {visibleUnits.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleUnits.map((unit) => (
            <label key={unit.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-white p-3 hover:border-primary/50">
              <input type="checkbox" checked={selected.has(unit.id)} onChange={() => setSelected((current) => {
                const next = new Set(current);
                if (next.has(unit.id)) next.delete(unit.id); else next.add(unit.id);
                return next;
              })} className="mt-0.5 size-4 accent-primary" />
              <span className="text-xs"><span className="block font-semibold text-text-primary">{unit.code} · {unit.name}</span>{unit.isSelected ? <span className="mt-1 block text-text-muted">Already registered</span> : null}</span>
            </label>
          ))}
        </div>
      ) : <p className="rounded-lg border border-dashed border-border p-3 text-xs text-text-muted">No units are mapped to this stage. Add them in Programme Stage Setup.</p>}
      <p className="text-xs text-text-muted">{selected.size} unit{selected.size === 1 ? '' : 's'} selected across stages. Changing registration stage does not change the student&apos;s academic stage.</p>
      {[...selected].map((unitId) => <input key={unitId} type="hidden" name="unitIds" value={unitId} />)}
    </div>
  );
}
