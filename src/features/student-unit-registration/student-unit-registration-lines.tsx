'use client';

import { useMemo, useState, useTransition } from 'react';
import { LoaderCircle, MoreVertical, Pencil, Trash2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { batchDropStudentUnitRegistrations, dropStudentUnitRegistration } from './actions';
import type { DepartmentRegistrationEditor } from './types';

interface RegistrationLine {
  id: number;
  stageId: string;
  unitId: string;
}

export function StudentUnitRegistrationLines({
  context,
  returnCohort,
}: {
  context: DepartmentRegistrationEditor;
  returnCohort?: string | null;
}) {
  const [pendingUnitId, setPendingUnitId] = useState<string | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<RegistrationLine[]>([{ id: 0, stageId: '', unitId: '' }]);
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ unitId: string; stageId: string; replacementId: string } | null>(null);
  const currentIds = useMemo(() => new Set(context.currentRegisteredUnitIds), [context.currentRegisteredUnitIds]);
  const chosenIds = new Set(lines.map((line) => line.unitId).filter(Boolean));
  const expectedIds = new Set(context.stageUnitIds[context.student.currentStageId ?? ''] ?? []);
  const selectedCurrentIds = context.currentRegisteredUnitIds.map((unitId) => replacements[unitId] ?? unitId);
  const hasOffStageSelection = [...selectedCurrentIds, ...chosenIds].some((unitId) => !expectedIds.has(unitId));

  const currentRegistrations = useMemo(
    () => context.registrationHistory.filter(
      (r) => r.academicPeriodId === context.period.id && r.registrationStatus === 'registered',
    ),
    [context.registrationHistory, context.period.id],
  );

  const allCurrentSelected = currentRegistrations.length > 0 && currentRegistrations.every((r) => selectedUnitIds.has(r.unitId));
  const someCurrentSelected = currentRegistrations.some((r) => selectedUnitIds.has(r.unitId)) && !allCurrentSelected;

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedUnitIds(new Set());
    } else {
      setSelectedUnitIds(new Set(currentRegistrations.map((r) => r.unitId)));
    }
  };

  const toggleSelectUnit = (unitId: string) => {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  const updateLine = (id: number, updates: Partial<Omit<RegistrationLine, 'id'>>) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...updates } : line));
  };

  const addLine = () => {
    setLines((current) => [...current, { id: Math.max(-1, ...current.map((line) => line.id)) + 1, stageId: '', unitId: '' }]);
  };

  const handleDelete = (unitId: string, academicPeriodId: string, unitCode: string) => {
    if (!window.confirm(`Are you sure you want to delete the unit registration for ${unitCode}? This will remove the student from this unit.`)) {
      return;
    }
    setPendingUnitId(unitId);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('studentId', context.student.id);
      formData.set('registrationUnitId', unitId);
      formData.set('academicPeriodId', academicPeriodId);
      if (returnCohort) formData.set('returnCohort', returnCohort);
      await dropStudentUnitRegistration(formData);
    });
  };

  const handleBatchDelete = (unitIdsToDelete?: string[]) => {
    const targets = unitIdsToDelete ?? Array.from(selectedUnitIds);
    if (targets.length === 0) return;

    const count = targets.length;
    const unitCodes = currentRegistrations
      .filter((r) => targets.includes(r.unitId))
      .map((r) => r.unitCode)
      .join(', ');

    const message = count === 1
      ? `Are you sure you want to delete the unit registration for ${unitCodes}? This will remove the student from this unit.`
      : `Are you sure you want to delete ${count} unit registrations (${unitCodes})? This will remove the student from these units' markbook rosters.`;

    if (!window.confirm(message)) {
      return;
    }

    setPendingUnitId('batch');
    startTransition(async () => {
      const formData = new FormData();
      formData.set('studentId', context.student.id);
      for (const id of targets) {
        formData.append('unitIds', id);
      }
      formData.set('academicPeriodId', context.period.id);
      if (returnCohort) formData.set('returnCohort', returnCohort);
      await batchDropStudentUnitRegistrations(formData);
    });
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Registered units</h2>
            <p className="mt-0.5 text-xs text-text-muted">Previous and current registrations are listed by academic period and curriculum stage.</p>
          </div>
          {currentRegistrations.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {selectedUnitIds.size > 0 ? (
                <>
                  <span className="rounded-md bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                    {selectedUnitIds.size} of {currentRegistrations.length} selected
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleBatchDelete()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-danger px-3 text-xs font-semibold text-white shadow-2xs hover:bg-danger-hover transition disabled:opacity-50 active:scale-95"
                  >
                    {isPending && pendingUnitId === 'batch' ? (
                      <>
                        <LoaderCircle className="size-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="size-3.5" />
                        <span>Delete selected ({selectedUnitIds.size})</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUnitIds(new Set())}
                    className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-secondary hover:bg-surface-subtle transition"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleBatchDelete(currentRegistrations.map((r) => r.unitId))}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/5 px-3 text-xs font-semibold text-danger hover:bg-danger/10 transition active:scale-95 disabled:opacity-50"
                  title="Delete all units registered in this academic period"
                >
                  <Trash2 className="size-3.5" />
                  <span>Unregister all ({currentRegistrations.length})</span>
                </button>
              )}
            </div>
          ) : null}
        </div>
        {context.registrationHistory.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-left text-xs">
              <colgroup>
                <col className="w-10" />
                <col className="w-[17%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[27%]" />
                <col className="w-[15%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead className="border-b border-border bg-surface-subtle text-[10px] font-medium uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center">
                    {currentRegistrations.length > 0 ? (
                      <input
                        type="checkbox"
                        checked={allCurrentSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someCurrentSelected;
                        }}
                        onChange={toggleSelectAll}
                        aria-label="Select all current registrations"
                        className="size-3.5 rounded border-border text-primary focus:ring-primary"
                      />
                    ) : null}
                  </th>
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
                  const isSelected = selectedUnitIds.has(registration.unitId);
                  const replacement = context.units.find((unit) => unit.id === (replacements[registration.unitId] ?? registration.unitId));
                  const stageId = isEditing ? editing.stageId : replacements[registration.unitId] ? replacement?.stageId ?? '' : registration.stageId ?? '';
                  const occupiedIds = new Set([...currentIds].filter((unitId) => unitId !== registration.unitId).map((unitId) => replacements[unitId] ?? unitId));
                  const rowUnits = context.units.filter((unit) => unit.stageId === stageId && (!occupiedIds.has(unit.id) || unit.id === registration.unitId) && (!chosenIds.has(unit.id) || unit.id === registration.unitId));

                  return (
                    <tr
                      key={`${registration.academicPeriodId}:${registration.unitId}`}
                      className={
                        isSelected
                          ? 'bg-amber-50/60 dark:bg-amber-950/20'
                          : isEditing
                            ? 'bg-primary/5'
                            : undefined
                      }
                    >
                      <td className="w-10 px-3 py-2.5 text-center">
                        {isCurrent ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectUnit(registration.unitId)}
                            aria-label={`Select ${registration.unitCode}`}
                            className="size-3.5 rounded border-border text-primary focus:ring-primary"
                          />
                        ) : null}
                      </td>
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
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`Actions for ${registration.unitCode}`}
                                  className="flex size-7 cursor-pointer items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-subtle"
                                >
                                  <MoreVertical className="size-4" aria-hidden="true" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-32 p-1">
                                {registration.registrationStatus === 'registered' ? (
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setEditing({
                                        unitId: registration.unitId,
                                        stageId: registration.stageId ?? context.student.currentStageId ?? '',
                                        replacementId: replacements[registration.unitId] ?? registration.unitId,
                                      });
                                    }}
                                    className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-subtle"
                                  >
                                    <Pencil className="size-3.5 text-text-muted" aria-hidden="true" />
                                    <span>Edit</span>
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                  destructive
                                  disabled={isPending && pendingUnitId === registration.unitId}
                                  onSelect={() => {
                                    setTimeout(() => {
                                      handleDelete(registration.unitId, registration.academicPeriodId, registration.unitCode);
                                    }, 50);
                                  }}
                                  className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-subtle disabled:opacity-50"
                                >
                                  {isPending && pendingUnitId === registration.unitId ? (
                                    <>
                                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                                      <span>Deleting...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="size-3.5" aria-hidden="true" />
                                      <span>Delete</span>
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
          <h2 className="text-sm font-medium text-text-primary">Add units for {context.period.name}</h2>
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
                      <select aria-label="Unit stage" value={line.stageId} onChange={(event) => updateLine(line.id, { stageId: event.target.value, unitId: '' })} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs">
                        <option value="">Select stage</option>
                        {context.stageOptions.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select aria-label="Unit to add" value={line.unitId} onChange={(event) => updateLine(line.id, { unitId: event.target.value })} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs disabled:bg-surface-subtle" disabled={!line.stageId} required={Boolean(line.stageId)}>
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
