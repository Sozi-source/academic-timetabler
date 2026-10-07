import { ArrowLeft, BarChart3, BookOpenCheck, FileSpreadsheet, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getStudentById } from '@/features/students/queries';
import { getStudentPortalResults } from '@/features/student-portal/queries';

function gradeLabel(mark: number | null, maximum: number | null): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (mark === null || maximum === null || maximum === 0) return { label: '—', variant: 'neutral' };
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

  const sortedPeriods = [...byPeriod.entries()].sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="space-y-5 pb-12">
      {/* Back navigation */}
      <div>
        <Link
          href={`/students/registry/${studentId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to student record</span>
        </Link>
      </div>

      <PageHeader
        title="Academic Results"
        description={`${student.full_name} · ${student.admission_number}`}
        icon={GraduationCap}
        context={
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{results.length} result{results.length !== 1 ? 's' : ''}</Badge>
            <Badge variant="neutral">{sortedPeriods.length} semester{sortedPeriods.length !== 1 ? 's' : ''}</Badge>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/students/registry/${studentId}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <ArrowLeft className="size-3.5 text-slate-500" />
              <span>Student Record</span>
            </Link>
          </div>
        }
      />

      {results.length === 0 ? (
        <Card className="p-8 text-center shadow-2xs">
          <GraduationCap className="mx-auto mb-3 size-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No published results yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Results will appear here once assessment marks have been submitted and published by the HoD.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedPeriods.map(([periodName, periodResults]) => {
            const examResults = periodResults.filter((r) => r.assessmentType === 'exam');
            const catResults = periodResults.filter((r) => r.assessmentType === 'cat');

            return (
              <section key={periodName} className="space-y-2.5">
                {/* Period header */}
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="size-3.5 text-primary" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {periodName}
                  </h2>
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] font-semibold text-slate-400">
                    {periodResults.length} unit{periodResults.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Exam marks table */}
                {examResults.length > 0 && (
                  <Card className="overflow-hidden shadow-2xs">
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                      <FileSpreadsheet className="size-3.5 text-teal-700" />
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                        Unit Examinations
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500">
                          <tr>
                            <th className="px-4 py-2.5">Unit</th>
                            <th className="px-3 py-2.5 text-center">Assgn /5</th>
                            <th className="px-3 py-2.5 text-center">Pres /10</th>
                            <th className="px-3 py-2.5 text-center">RAT /15</th>
                            <th className="px-3 py-2.5 text-center">CAT /15</th>
                            <th className="px-3 py-2.5 text-center">RAT/CAT</th>
                            <th className="px-3 py-2.5 text-center">Exam /70</th>
                            <th className="px-3 py-2.5 text-center font-bold text-slate-700">Total /100</th>
                            <th className="px-3 py-2.5 text-center">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {examResults.map((result) => {
                            const grade = gradeLabel(result.mark, result.maximumMark);
                            const comps = result.componentMarks;
                            return (
                              <tr key={result.id} className="hover:bg-slate-50/50 transition">
                                <td className="px-4 py-2.5">
                                  <p className="font-semibold text-slate-900 leading-snug">{result.unitName}</p>
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono text-slate-700">
                                  {fmt(comps?.assignment ?? null)}
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono text-slate-700">
                                  {fmt(comps?.presentation ?? null)}
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono text-slate-700">
                                  {fmt(comps?.rat ?? null)}
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono text-slate-700">
                                  {fmt(comps?.cat ?? null)}
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono text-slate-500">
                                  {fmt(comps?.ratCatAverage ?? null)}
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono text-slate-700">
                                  {fmt(comps?.exam ?? null)}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="font-mono text-sm font-bold text-slate-900">
                                    {result.mark !== null ? result.mark : '—'}
                                  </span>
                                  {result.maximumMark ? (
                                    <span className="text-[10px] text-slate-400"> /{result.maximumMark}</span>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {result.mark !== null ? (
                                    <Badge variant={grade.variant} className="text-[10px]">
                                      {grade.label}
                                    </Badge>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">—</span>
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
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-amber-50/60 px-4 py-2.5">
                      <BarChart3 className="size-3.5 text-amber-700" />
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                        Continuous Assessment Tests (CAT)
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500">
                          <tr>
                            <th className="px-4 py-2.5">Unit</th>
                            <th className="px-3 py-2.5 text-center">Mark</th>
                            <th className="px-3 py-2.5 text-center">Maximum</th>
                            <th className="px-3 py-2.5 text-center">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {catResults.map((result) => {
                            const grade = gradeLabel(result.mark, result.maximumMark);
                            return (
                              <tr key={result.id} className="hover:bg-slate-50/50 transition">
                                <td className="px-4 py-2.5 font-semibold text-slate-900">{result.unitName}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900">
                                  {result.mark !== null ? result.mark : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono text-slate-400">
                                  {result.maximumMark ?? '—'}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {result.mark !== null ? (
                                    <Badge variant={grade.variant} className="text-[10px]">
                                      {grade.label}
                                    </Badge>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">—</span>
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
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
