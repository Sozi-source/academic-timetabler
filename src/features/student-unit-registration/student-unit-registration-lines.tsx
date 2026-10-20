'use client';

import { useMemo, useState } from 'react';

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
  const currentIds = useMemo(() => new Set(context.currentRegisteredUnitIds), [context.currentRegisteredUnitIds]);
  const chosenIds = new Set(lines.map((line) => line.unitId).filter(Boolean));
  const expectedIds = new Set(context.stageUnitIds[context.student.currentStageId ?? ''] ?? []);
  const hasOffStageSelection = [...currentIds, ...chosenIds].some((unitId) => !expectedIds.has(unitId));

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
                {context.registrationHistory.map((registration) => (
                  <tr key={`${registration.academicPeriodId}:${registration.unitId}`}>
                    <td className="px-3 py-2.5 text-text-secondary">{registration.academicPeriodName}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{registration.stageName}</td>
                    <td className="px-3 py-2.5 font-mono text-text-secondary">{registration.unitCode}</td>
                    <td className="px-3 py-2.5 text-text-primary">{registration.unitName}</td>
                    <td className="px-3 py-2.5">
                      <span className={registration.registrationStatus === 'registered' ? 'inline-flex items-center gap-1.5 text-emerald-700' : 'text-text-muted'}>
                        {registration.registrationStatus === 'registered' ? <span aria-hidden="true">✓</span> : null}
                        {registration.registrationStatus.replaceAll('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
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
        {[...currentIds].map((unitId) => <input key={unitId} type="hidden" name="unitIds" value={unitId} />)}
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
