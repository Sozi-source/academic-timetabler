'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, UsersRound } from 'lucide-react';
import { TrainerUnitMarkInvites } from './trainer-unit-mark-invites';

interface UnitCohort {
  id: string;
  code: string;
  name: string;
  students: Array<{ id: string; admissionNumber: string; fullName: string }>;
  markbooks: Array<{ id: string; assessmentType: string }>;
}

interface AssessmentUnitCohortsProps {
  unit: { id: string; code: string; name: string };
  periodName: string;
  periodId: string;
  cohorts: UnitCohort[];
}

export function AssessmentUnitCohorts({ unit, periodName, periodId, cohorts }: AssessmentUnitCohortsProps) {
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const selectedCohort = cohorts.find((cohort) => cohort.id === selectedCohortId) ?? null;

  return (
    <div className="space-y-4 pb-10 text-slate-700">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-4 shadow-2xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary"><UsersRound className="size-4" /></span>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-xs font-medium text-primary">{unit.code}</p>
            <h1 className="truncate text-base font-semibold text-slate-700" title={unit.name}>{unit.name}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{periodName} · current registered students</p>
          </div>
        </div>
        <Link href="/assessment" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-slate-600 hover:bg-surface-subtle">
          <ArrowLeft className="size-3.5" /> All units
        </Link>
      </header>

      <TrainerUnitMarkInvites unitId={unit.id} unitName={`${unit.code} · ${unit.name}`} periodId={periodId} periodName={periodName} />

      <section className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-2xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Choose a cohort</h2>
          <p className="mt-0.5 text-xs text-slate-500">Select a cohort to show its currently registered students and available markbooks.</p>
        </div>

        {cohorts.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No students are currently registered for this unit in this academic period.</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cohorts">
            {cohorts.map((cohort) => {
              const isSelected = cohort.id === selectedCohortId;
              return (
                <button
                  key={cohort.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCohortId(isSelected ? null : cohort.id)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    isSelected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-white text-slate-600 hover:border-primary/30 hover:bg-surface-subtle'
                  }`}
                >
                  <span>{cohort.name}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 tabular-nums text-[10px] text-slate-500">{cohort.students.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedCohort ? (
        <section className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">{selectedCohort.name}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{selectedCohort.students.length} currently registered {selectedCohort.students.length === 1 ? 'student' : 'students'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedCohort.markbooks.map((markbook) => (
                <Link
                  key={markbook.id}
                  href={`/assessment/marks/${markbook.id}`}
                  className="inline-flex h-8 items-center rounded-lg border border-primary/20 bg-white px-3 text-xs font-medium text-primary hover:bg-primary/5"
                >
                  Open {markbook.assessmentType.toUpperCase()} markbook
                </Link>
              ))}
            </div>
          </div>

          <div className="max-h-[34rem] overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[560px] table-fixed text-left text-xs">
              <colgroup><col className="w-14" /><col className="w-[32%]" /><col /></colgroup>
              <thead className="sticky top-0 border-b border-border bg-surface-subtle text-[10px] font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">No.</th>
                  <th className="px-3 py-2.5">Admission number</th>
                  <th className="px-3 py-2.5">Student name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selectedCohort.students.map((student, index) => (
                  <tr key={student.id} className="hover:bg-surface-subtle/50">
                    <td className="px-3 py-2.5 tabular-nums text-slate-400">{index + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-600">{student.admissionNumber}</td>
                    <td className="truncate px-3 py-2.5 text-slate-600" title={student.fullName}>{student.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
