import { BarChart3, Download, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getAssessmentAnalysis } from '@/features/assessment/analysis/queries';
import { requireHodAccess } from '@/features/auth/authorization';

function metric(value: number | null, digits = 1) {
  return value === null ? '—' : value.toFixed(digits);
}

export default async function AssessmentAnalysisDetailPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  await requireHodAccess();
  const { assessmentId } = await params;
  const analysis = await getAssessmentAnalysis(assessmentId);
  if (!analysis) notFound();

  const unresolved = analysis.students.filter((student) => student.attendanceStatus === 'present' && student.totalMark === null);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment analysis"
        title={`${analysis.event.unit?.code ?? 'Unit'} · ${analysis.event.title}`}
        description={analysis.event.academic_period?.name ?? 'Academic period'}
        icon={BarChart3}
        context={
          <div className="flex items-center gap-2">
            <Badge variant={analysis.event.assessment_type === 'exam' ? 'warning' : 'neutral'}>{analysis.event.assessment_type === 'exam' ? 'Exam' : 'CAT'}</Badge>
            <Link href={`/api/assessment/analysis/${assessmentId}/export`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white hover:bg-primary/90"><Download className="size-3.5" />Excel</Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['Expected', analysis.expected],
          ['Present', analysis.present],
          ['Absent', analysis.absent],
          ['Marked', analysis.marked],
          ['Mean', metric(analysis.mean)],
          ['Pass rate', analysis.passRate === null ? '—' : `${analysis.passRate.toFixed(1)}%`],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-3.5"><p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-text-muted">{label}</p><p className="mt-1 text-xl font-extrabold text-text-primary">{value}</p></Card>
        ))}
      </div>

      {analysis.event.assessment_type === 'exam' ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="p-3.5"><p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-text-muted">Coursework mean /30</p><p className="mt-1 text-lg font-extrabold text-text-primary">{metric(analysis.courseworkMean)}</p></Card>
          <Card className="p-3.5"><p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-text-muted">Exam mean /70</p><p className="mt-1 text-lg font-extrabold text-text-primary">{metric(analysis.examMean)}</p></Card>
          <Card className="p-3.5"><p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-text-muted">Highest</p><p className="mt-1 text-lg font-extrabold text-text-primary">{metric(analysis.highest)}</p></Card>
          <Card className="p-3.5"><p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-text-muted">Lowest</p><p className="mt-1 text-lg font-extrabold text-text-primary">{metric(analysis.lowest)}</p></Card>
        </div>
      ) : null}

      {unresolved.length > 0 ? (
        <Card className="flex items-start gap-3 border-warning/30 bg-warning/5 p-3.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div><p className="text-xs font-bold text-text-primary">{unresolved.length} present student{unresolved.length === 1 ? '' : 's'} without committed marks</p><p className="mt-0.5 text-[0.6875rem] text-text-secondary">Complete the marks upload before treating this as the final analysis.</p></div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3"><p className="text-sm font-bold text-text-primary">By cohort</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-surface-subtle text-text-muted"><tr><th className="px-4 py-2.5">Cohort</th><th className="px-3 py-2.5">Expected</th><th className="px-3 py-2.5">Present</th><th className="px-3 py-2.5">Absent</th><th className="px-3 py-2.5">Marked</th><th className="px-3 py-2.5">Missing</th><th className="px-3 py-2.5">Pass</th><th className="px-3 py-2.5">Fail</th><th className="px-3 py-2.5">Mean</th></tr></thead>
            <tbody className="divide-y divide-border">
              {analysis.cohorts.map((row) => <tr key={row.cohortId}><td className="px-4 py-2.5 font-bold text-text-primary">{row.cohortName || row.cohortCode}</td><td className="px-3 py-2.5">{row.expected}</td><td className="px-3 py-2.5">{row.present}</td><td className="px-3 py-2.5">{row.absent}</td><td className="px-3 py-2.5">{row.marked}</td><td className="px-3 py-2.5">{row.missingMarks}</td><td className="px-3 py-2.5">{row.passed}</td><td className="px-3 py-2.5">{row.failed}</td><td className="px-3 py-2.5 font-semibold">{metric(row.mean)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3"><p className="text-sm font-bold text-text-primary">Student results</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-surface-subtle text-text-muted"><tr><th className="px-4 py-2.5">Student</th><th className="px-3 py-2.5">Cohort</th><th className="px-3 py-2.5">Attendance</th><th className="px-3 py-2.5">Mark</th><th className="px-3 py-2.5">Grade</th><th className="px-3 py-2.5">Comment</th></tr></thead>
            <tbody className="divide-y divide-border">
              {analysis.students.map((student) => <tr key={student.studentId}><td className="px-4 py-2.5"><p className="font-bold text-text-primary">{student.fullName}</p><p className="mt-0.5 text-[0.625rem] text-text-muted">{student.admissionNumber}</p></td><td className="px-3 py-2.5 text-text-secondary">{student.cohortName || student.cohortCode}</td><td className="px-3 py-2.5"><Badge variant={student.attendanceStatus === 'absent' ? 'warning' : student.attendanceStatus === 'present' ? 'success' : 'neutral'}>{student.attendanceStatus}</Badge></td><td className="px-3 py-2.5 font-bold text-text-primary">{student.attendanceStatus === 'absent' ? 'AB' : metric(student.totalMark)}</td><td className="px-3 py-2.5">{student.grade ?? '—'}</td><td className="px-3 py-2.5 text-text-secondary">{student.comment ?? '—'}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
