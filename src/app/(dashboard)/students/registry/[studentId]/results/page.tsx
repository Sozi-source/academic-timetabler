import { BarChart3, BookOpenCheck, FileSpreadsheet, GraduationCap } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FastTab } from '@/components/ui/fast-tab';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
                      <TableContainer embedded label="Unit examinations">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Unit</TableHead>
                              <TableHead className="text-center">Assgn /5</TableHead>
                              <TableHead className="text-center">Pres /10</TableHead>
                              <TableHead className="text-center">RAT /15</TableHead>
                              <TableHead className="text-center">CAT /15</TableHead>
                              <TableHead className="text-center">RAT/CAT</TableHead>
                              <TableHead className="text-center">Exam /70</TableHead>
                              <TableHead className="text-center text-text-primary">
                                Total /100
                              </TableHead>
                              <TableHead className="text-center">Grade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {examResults.map((result) => {
                              const grade = gradeLabel(
                                result.mark,
                                result.maximumMark,
                              );
                              const comps = result.componentMarks;
                              return (
                                <TableRow key={result.id}>
                                  <TableCell className="font-semibold text-text-primary">
                                    {result.unitName}
                                  </TableCell>
                                  <TableCell className="text-center font-mono text-text-secondary">
                                    {fmt(comps?.assignment ?? null)}
                                  </TableCell>
                                  <TableCell className="text-center font-mono text-text-secondary">
                                    {fmt(comps?.presentation ?? null)}
                                  </TableCell>
                                  <TableCell className="text-center font-mono text-text-secondary">
                                    {fmt(comps?.rat ?? null)}
                                  </TableCell>
                                  <TableCell className="text-center font-mono text-text-secondary">
                                    {fmt(comps?.cat ?? null)}
                                  </TableCell>
                                  <TableCell className="text-center font-mono text-text-muted">
                                    {fmt(comps?.ratCatAverage ?? null)}
                                  </TableCell>
                                  <TableCell className="text-center font-mono text-text-secondary">
                                    {fmt(comps?.exam ?? null)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="font-mono text-sm font-bold text-text-primary">
                                      {result.mark !== null ? result.mark : '—'}
                                    </span>
                                    {result.maximumMark ? (
                                      <span className="text-[11px] font-medium text-text-muted">
                                        {' '}/{result.maximumMark}
                                      </span>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {result.mark !== null ? (
                                      <Badge
                                        variant={grade.variant}
                                        className="text-[10px] font-bold"
                                      >
                                        {grade.label}
                                      </Badge>
                                    ) : (
                                      <span className="text-[11px] font-bold text-text-muted">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
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
                      <TableContainer embedded label="Continuous assessment tests">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Unit</TableHead>
                              <TableHead className="text-center">Mark</TableHead>
                              <TableHead className="text-center">Maximum</TableHead>
                              <TableHead className="text-center">Grade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {catResults.map((result) => {
                              const grade = gradeLabel(
                                result.mark,
                                result.maximumMark,
                              );
                              return (
                                <TableRow key={result.id}>
                                  <TableCell className="font-semibold text-text-primary">
                                    {result.unitName}
                                  </TableCell>
                                  <TableCell className="text-center font-mono font-bold text-text-primary">
                                    {result.mark !== null ? result.mark : '—'}
                                  </TableCell>
                                  <TableCell className="text-center font-mono font-medium text-text-secondary">
                                    {result.maximumMark ?? '—'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {result.mark !== null ? (
                                      <Badge
                                        variant={grade.variant}
                                        className="text-[10px] font-bold"
                                      >
                                        {grade.label}
                                      </Badge>
                                    ) : (
                                      <span className="text-[11px] font-bold text-text-muted">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
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
