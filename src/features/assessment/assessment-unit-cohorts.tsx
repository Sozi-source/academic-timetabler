'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, UsersRound } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
            <h1 className="truncate text-base font-semibold text-slate-700" title={unit.name}>{unit.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              {unit.code ? (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-500 border border-slate-200">
                  {unit.code}
                </span>
              ) : null}
              <span className="text-slate-300">·</span>
              <span>{periodName}</span>
              <span className="text-slate-300">·</span>
              <span>Registered Students</span>
            </div>
          </div>
        </div>
        <Link href="/assessment" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-slate-600 hover:bg-surface-subtle">
          <ArrowLeft className="size-3.5" /> All units
        </Link>
      </header>


      <section className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-2xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Choose a cohort</h2>
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

          <TableContainer label="Registered students" className="max-h-[34rem] overflow-y-auto shadow-none">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14">No.</TableHead>
                  <TableHead>Admission number</TableHead>
                  <TableHead>Student name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedCohort.students.map((student, index) => (
                  <TableRow key={student.id}>
                    <TableCell className="tabular-nums text-text-muted">{index + 1}</TableCell>
                    <TableCell className="font-mono text-text-secondary">{student.admissionNumber}</TableCell>
                    <TableCell className="font-semibold text-text-primary">{student.fullName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </section>
      ) : null}
    </div>
  );
}
