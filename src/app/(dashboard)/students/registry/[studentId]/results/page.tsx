import { BarChart3, BookOpenCheck, FileSpreadsheet, GraduationCap } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FastTab } from '@/components/ui/fast-tab';
import { requireHodAccess } from '@/features/auth/authorization';
import { getStudentPortalResults } from '@/features/student-portal/queries';
import { getStudentById } from '@/features/students/queries';

function gradeLabel(
  mark: number | null,
  maximum: number | null,
): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (mark === null || maximum === null || maximum === 0) {
    return { label: '—', variant: 'neutral' };
  }
  const pct = (mark / maximum) * 100;
  if (pct >= 75) return { label: 'Distinction', variant: 'success' };
  if (pct >= 65) return { label: 'Credit', variant: 'success' };
  if (pct >= 50) return { label: 'Pass', variant: 'warning' };
  if (pct >= 40) return { label: 'Pass', variant: 'warning' };
  return { label: 'Fail / Refer', variant: 'danger' };
}

function fmt(value: number | null, suffix = ''): string {
  if (value === null || value === undefined) return '—';
  return `${value}${suffix}`;
}

export default async function StudentResultsAdminPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requireHodAccess();
  const { studentId } = await params;

  const [student, results] = await Promise.all([
    getStudentById(studentId),
    getStudentPortalResults(studentId).catch(() => []),
  ]);

  if (!student) notFound();

  // Group results by academic period name
  const byPeriod = new Map<string, typeof results>();
  for (const result of results) {
    const key = result.periodName || 'Unknown Period';
    if (!byPeriod.has(key)) byPeriod.set(key, []);
    byPeriod.get(key)!.push(result);
  }

  const sortedPeriods = [...byPeriod.entries()].sort(([a], [b]) =>
    b.localeCompare(a),
  );

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <BookOpenCheck className="size-4 text-primary" aria-hidden="true" />
          <span className="font-semibold text-text-primary">
            Published Assessment Transcript
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="neutral">
            {sortedPeriods.length} semester{sortedPeriods.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {results.length === 0 ? (
        <Card className="p-8 text-center shadow-2xs">
          <GraduationCap className="mx-auto mb-3 size-8 text-text-subtle" />
          <p className="text-sm font-semibold text-text-primary">
            No published results yet
          </p>
          <p className="mt-1 text-xs font-medium text-text-muted">
            Results will appear here once assessment marks have been submitted and published by the HoD.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedPeriods.map(([periodName, periodResults]) => {
            const examResults = periodResults.filter(
              (r) => r.assessmentType === 'exam',
            );
            const catResults = periodResults.filter(
              (r) => r.assessmentType === 'cat',
            );

            return (
              <FastTab
                key={periodName}
                title={periodName}
                summary={`${periodResults.length} unit${periodResults.length !== 1 ? 's' : ''}`}
              >
                <div className="space-y-4">
                  {/* Exam marks table */}
                  {examResults.length > 0 && (
                    <Card className="overflow-hidden shadow-2xs">
                      <div className="flex items-center gap-2 border-b border-border bg-surface-subtle px-4 py-2">
                        <FileSpreadsheet className="size-3.5 text-primary" />
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-primary">
                          Unit Examinations
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-border bg-surface-subtle text-[11px] font-bold text-text-muted">
                            <tr>
                              <th className="px-4 py-2.5">Unit</th>
                              <th className="px-3 py-2.5 text-center">Assgn /5</th>
                              <th className="px-3 py-2.5 text-center">Pres /10</th>
                              <th className="px-3 py-2.5 text-center">RAT /15</th>
                              <th className="px-3 py-2.5 text-center">CAT /15</th>
                              <th className="px-3 py-2.5 text-center">RAT/CAT</th>
                              <th className="px-3 py-2.5 text-center">Exam /70</th>
                              <th className="px-3 py-2.5 text-center font-bold text-text-primary">
                                Total /100
                              </th>
                              <th className="px-3 py-2.5 text-center">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-soft">
                            {examResults.map((result) => {
                              const grade = gradeLabel(
                                result.mark,
                                result.maximumMark,
                              );
                              const comps = result.componentMarks;
                              return (
                                <tr
                                  key={result.id}
                                  className="transition hover:bg-surface-subtle/60"
                                >
                                  <td className="px-4 py-2.5">
                                    <p className="font-semibold leading-snug text-text-primary">
                                      {result.unitName}
                                    </p>
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono text-text-secondary">
                                    {fmt(comps?.assignment ?? null)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono text-text-secondary">
                                    {fmt(comps?.presentation ?? null)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono text-text-secondary">
                                    {fmt(comps?.rat ?? null)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono text-text-secondary">
                                    {fmt(comps?.cat ?? null)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono text-text-muted">
                                    {fmt(comps?.ratCatAverage ?? null)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono text-text-secondary">
                                    {fmt(comps?.exam ?? null)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="font-mono text-sm font-bold text-text-primary">
                                      {result.mark !== null ? result.mark : '—'}
                                    </span>
                                    {result.maximumMark ? (
                                      <span className="text-[10px] font-medium text-text-muted">
                                        {' '}
                                        /{result.maximumMark}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {result.mark !== null ? (
                                      <Badge
                                        variant={grade.variant}
                                        className="text-[10px] font-bold"
                                      >
                                        {grade.label}
                                      </Badge>
                                    ) : (
                                      <span className="text-[10px] font-bold text-text-muted">
                                        —
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {/* CAT marks table */}
                  {catResults.length > 0 && (
                    <Card className="overflow-hidden shadow-2xs">
                      <div className="flex items-center gap-2 border-b border-border bg-surface-subtle px-4 py-2">
                        <BarChart3 className="size-3.5 text-primary" />
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-primary">
                          Continuous Assessment Tests (CAT)
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-border bg-surface-subtle text-[11px] font-bold text-text-muted">
                            <tr>
                              <th className="px-4 py-2.5">Unit</th>
                              <th className="px-3 py-2.5 text-center">Mark</th>
                              <th className="px-3 py-2.5 text-center">Maximum</th>
                              <th className="px-3 py-2.5 text-center">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-soft">
                            {catResults.map((result) => {
                              const grade = gradeLabel(
                                result.mark,
                                result.maximumMark,
                              );
                              return (
                                <tr
                                  key={result.id}
                                  className="transition hover:bg-surface-subtle/60"
                                >
                                  <td className="px-4 py-2.5 font-semibold text-text-primary">
                                    {result.unitName}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono font-bold text-text-primary">
                                    {result.mark !== null ? result.mark : '—'}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono font-medium text-text-secondary">
                                    {result.maximumMark ?? '—'}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {result.mark !== null ? (
                                      <Badge
                                        variant={grade.variant}
                                        className="text-[10px] font-bold"
                                      >
                                        {grade.label}
                                      </Badge>
                                    ) : (
                                      <span className="text-[10px] font-bold text-text-muted">
                                        —
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>
              </FastTab>
            );
          })}
        </div>
      )}
    </div>
  );
}
