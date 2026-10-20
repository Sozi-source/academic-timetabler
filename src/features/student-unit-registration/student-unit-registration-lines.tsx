'use client';

import { useMemo, useState } from 'react';
import { MoreVertical } from 'lucide-react';

import { dropStudentUnitRegistration } from './actions';
import type { DepartmentRegistrationEditor } from './types';

interface RegistrationLine {
  id: number;
  stageId: string;
  unitId: string;
}

export function StudentUnitRegistrationLines({
  context,
}: {
  context: DepartmentRegistrationEditor;
}) {
  const [lines, setLines] = useState<RegistrationLine[]>([{ id: 0, stageId: '', unitId: '' }]);
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ unitId: string; stageId: string; replacementId: string } | null>(null);
  const currentIds = useMemo(() => new Set(context.currentRegisteredUnitIds), [context.currentRegisteredUnitIds]);
  const chosenIds = new Set(lines.map((line) => line.unitId).filter(Boolean));
  const expectedIds = new Set(context.stageUnitIds[context.student.currentStageId ?? ''] ?? []);
  const selectedCurrentIds = context.currentRegisteredUnitIds.map((unitId) => replacements[unitId] ?? unitId);
  const hasOffStageSelection = [...selectedCurrentIds, ...chosenIds].some((unitId) => !expectedIds.has(unitId));

  const updateLine = (id: number, updates: Partial<Omit<RegistrationLine, 'id'>>) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...updates } : line));
  };

  const addLine = () => {
    setLines((current) => [...current, { id: Math.max(-1, ...current.map((line) => line.id)) + 1, stageId: '', unitId: '' }]);
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text-primary">Registered units</h2>
          <p className="mt-0.5 text-xs text-text-muted">Previous and current registrations are listed by academic period and curriculum stage.</p>
        </div>
        {context.registrationHistory.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[17%]" />
                <col className="w-[15%]" />
                <col className="w-[28%]" />
                <col className="w-[15%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead className="border-b border-border bg-surface-subtle text-[10px] font-medium uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-3 py-2.5">Academic year</th>
                  <th className="px-3 py-2.5">Student stage</th>
                  <th className="px-3 py-2.5">Unit code</th>
                  <th className="px-3 py-2.5">Unit name</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {context.registrationHistory.map((registration) => {
                  const isCurrent = registration.academicPeriodId === context.period.id && registration.registrationStatus === 'registered';
                  const isEditing = editing?.unitId === registration.unitId && isCurrent;
                  const replacement = context.units.find((unit) => unit.id === (replacements[registration.unitId] ?? registration.unitId));
                  const stageId = isEditing ? editing.stageId : replacements[registration.unitId] ? replacement?.stageId ?? '' : registration.stageId ?? '';
                  const occupiedIds = new Set([...currentIds].filter((unitId) => unitId !== registration.unitId).map((unitId) => replacements[unitId] ?? unitId));
                  const rowUnits = context.units.filter((unit) => unit.stageId === stageId && (!occupiedIds.has(unit.id) || unit.id === registration.unitId) && (!chosenIds.has(unit.id) || unit.id === registration.unitId));

                  return (
                    <tr key={`${registration.academicPeriodId}:${registration.unitId}`} className={isEditing ? 'bg-primary/5' : undefined}>
                      <td className="px-3 py-2.5 text-text-secondary">{registration.academicPeriodName}</td>
                      <td className="px-3 py-2.5 text-text-secondary">
                        {isEditing ? (
                          <select aria-label="Edit unit stage" value={editing.stageId} onChange={(event) => setEditing({ ...editing, stageId: event.target.value, replacementId: '' })} className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs">
                            <option value="">Select stage</option>
                            {context.stageOptions.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                          </select>
                        ) : replacement?.stageName ?? registration.stageName}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-text-secondary">{isEditing ? registration.unitCode : replacement?.code ?? registration.unitCode}</td>
                      <td className="px-3 py-2.5 text-text-primary">
                        {isEditing ? (
                          <select aria-label="Edit registered unit" value={editing.replacementId} onChange={(event) => setEditing({ ...editing, replacementId: event.target.value })} className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs" disabled={!editing.stageId}>
                            <option value="">Select unit</option>
                            {rowUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
                          </select>
                        ) : replacement?.name ?? registration.unitName}
                      </td>
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button type="button" disabled={!editing.replacementId} onClick={() => { setReplacements((current) => ({ ...current, [registration.unitId]: editing.replacementId })); setEditing(null); }} className="font-medium text-primary disabled:opacity-40">Apply</button>
                            <button type="button" onClick={() => setEditing(null)} className="text-text-muted hover:text-text-primary">Cancel</button>
                          </div>
                        ) : (
                          <span className={registration.registrationStatus === 'registered' ? 'inline-flex items-center gap-1.5 text-emerald-700' : 'text-text-muted'}>
                            {registration.registrationStatus === 'registered' ? <span aria-hidden="true">✓</span> : null}
                            {registration.registrationStatus.replaceAll('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isCurrent && !isEditing ? (
                          <details className="group relative inline-block text-left">
                            <summary aria-label={`Actions for ${registration.unitCode}`} className="flex size-7 cursor-pointer list-none items-center justify-center rounded-md text-text-secondary hover:bg-surface-subtle [&::-webkit-details-marker]:hidden">
                              <MoreVertical className="size-4" aria-hidden="true" />
                            </summary>
                            <div className="absolute right-0 z-10 mt-1 min-w-28 rounded-md border border-border bg-surface p-1 shadow-lg">
                              <button type="button" onClick={() => { setEditing({ unitId: registration.unitId, stageId: registration.stageId ?? context.student.currentStageId ?? '', replacementId: replacements[registration.unitId] ?? registration.unitId }); }} className="block w-full rounded px-2 py-1.5 text-left text-xs text-text-primary hover:bg-surface-subtle">Edit</button>
                              <button type="submit" formAction={dropStudentUnitRegistration} name="registrationUnitId" value={registration.unitId} className="block w-full rounded px-2 py-1.5 text-left text-xs text-danger hover:bg-danger-subtle">Delete</button>
                            </div>
                          </details>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-5 text-xs text-text-muted">No previous unit registrations are recorded for this student.</p>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Add units for {context.period.name}</h2>
            <p className="mt-0.5 text-xs text-text-muted">Choose a stage, then choose an available unit. Existing registrations stay selected.</p>
          </div>
          <button type="button" onClick={addLine} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-primary hover:bg-surface-subtle">
            Add a unit line
          </button>
        </div>
        <input type="hidden" name="academicPeriodId" value={context.period.id} />
        {selectedCurrentIds.map((unitId) => <input key={unitId} type="hidden" name="unitIds" value={unitId} />)}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-left text-xs">
            <colgroup>
              <col className="w-[19%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[32%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="border-b border-border bg-surface-subtle text-[10px] font-medium uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-3 py-2.5">Academic year</th>
                <th className="px-3 py-2.5">Student stage</th>
                <th className="px-3 py-2.5">Unit code</th>
                <th className="px-3 py-2.5">Unit name</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {context.registrationHistory
                .filter((registration) => registration.academicPeriodId === context.period.id && registration.registrationStatus === 'registered')
                .map((registration) => (
                  <tr key={`current:${registration.unitId}`}>
                    <td className="px-3 py-2.5 text-text-secondary">{registration.academicPeriodName}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{registration.stageName}</td>
                    <td className="px-3 py-2.5 font-mono text-text-secondary">{registration.unitCode}</td>
                    <td className="px-3 py-2.5 text-text-primary">{registration.unitName}</td>
                    <td className="px-3 py-2.5 text-emerald-700">✓ Registered</td>
                  </tr>
                ))}
              {lines.map((line) => {
                const stageUnits = context.units.filter((unit) => unit.stageId === line.stageId && !currentIds.has(unit.id));
                const unit = context.units.find((candidate) => candidate.id === line.unitId);
                const otherChosenIds = new Set(lines.filter((other) => other.id !== line.id).map((other) => other.unitId));
                return (
                  <tr key={line.id}>
                    <td className="px-3 py-2">
                      <span className="mb-1 block text-[10px] text-text-muted">{context.period.name}</span>
                    </td>
                    <td className="px-3 py-2">
                      <select aria-label="Unit stage" value={line.stageId} onChange={(event) => updateLine(line.id, { stageId: event.target.value, unitId: '' })} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs" required>
                        <option value="">Select stage</option>
                        {context.stageOptions.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select aria-label="Unit to add" value={line.unitId} onChange={(event) => updateLine(line.id, { unitId: event.target.value })} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs disabled:bg-surface-subtle" disabled={!line.stageId} required>
                        <option value="">Select unit</option>
                        {stageUnits.filter((candidate) => !otherChosenIds.has(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.code} · {candidate.name}</option>)}
                      </select>
                      {line.unitId ? <input type="hidden" name="unitIds" value={line.unitId} /> : null}
                    </td>
                    <td className="px-3 py-2 text-text-primary">{unit?.name ?? '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-text-muted">
                        <span>{line.unitId ? 'Ready to add' : 'Choose unit'}</span>
                        {lines.length > 1 ? <button type="button" aria-label="Remove unit line" onClick={() => setLines((current) => current.filter((other) => other.id !== line.id))} className="text-text-muted hover:text-danger">Remove</button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {hasOffStageSelection ? (
        <label htmlFor="registrationNote" className="block text-xs font-medium text-text-secondary">
          Reason for additional or cross-stage units
          <textarea id="registrationNote" name="registrationNote" defaultValue={context.existingNote ?? ''} rows={2} maxLength={1000} placeholder="For example: approved retake or missed unit" className="mt-1.5 w-full resize-none rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-primary" required />
        </label>
      ) : null}
      <p className="text-[11px] text-text-muted">{currentIds.size + chosenIds.size} units will be registered for this academic period.</p>
    </div>
  );
}
