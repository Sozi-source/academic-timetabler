'use client';

import { useMemo, useState } from 'react';
import { Search, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { saveTrainerExamAbsentees } from './actions';
import type { TrainerAttendanceStudent } from './types';

export function AbsenceSelector({
  assessmentId,
  students,
  locked,
}: {
  assessmentId: string;
  students: TrainerAttendanceStudent[];
  locked: boolean;
}) {
  const [query, setQuery] = useState('');
  const [absentIds, setAbsentIds] = useState<Set<string>>(
    () => new Set(students.filter((student) => student.isAbsent).map((student) => student.id)),
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      `${student.fullName} ${student.admissionNumber} ${student.cohortName}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query, students]);

  function toggle(studentId: string) {
    if (locked) return;
    setAbsentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  return (
    <form action={saveTrainerExamAbsentees} className="space-y-4">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      {[...absentIds].map((studentId) => (
        <input key={studentId} type="hidden" name="absentStudentIds" value={studentId} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or admission number"
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="rounded-lg bg-surface-subtle px-3 py-2 text-xs font-semibold text-text-secondary">
          {absentIds.size} absent · {students.length - absentIds.size} present
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="divide-y divide-border">
          {filtered.map((student) => {
            const absent = absentIds.has(student.id);
            return (
              <button
                key={student.id}
                type="button"
                onClick={() => toggle(student.id)}
                disabled={locked}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-subtle disabled:cursor-default"
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
                    absent ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'
                  }`}
                >
                  {absent ? <UserX className="size-3.5" /> : <span className="text-[0.65rem] font-bold">P</span>}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-text-primary">
                    {student.fullName}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.6875rem] text-text-muted">
                    {student.admissionNumber} · {student.cohortName}
                  </span>
                </span>

                <span className={`text-[0.6875rem] font-bold ${absent ? 'text-danger' : 'text-success'}`}>
                  {absent ? 'ABSENT' : 'PRESENT'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!locked ? (
        <div className="flex justify-end">
          <Button type="submit">
            Confirm exam attendance
          </Button>
        </div>
      ) : null}
    </form>
  );
}
