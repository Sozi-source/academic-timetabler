import { BarChart3, Download, GraduationCap, History, Paperclip, UserRoundCheck, UsersRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getStudents, getStudentSummary } from '@/features/students/queries';

interface CountRow {
  label: string;
  total: number;
  active: number;
  deferred: number;
  attachment: number;
  completed: number;
  graduated: number;
}

function groupStudents(
  students: Awaited<ReturnType<typeof getStudents>>,
  getLabel: (student: Awaited<ReturnType<typeof getStudents>>[number]) => string,
): CountRow[] {
  const grouped = new Map<string, CountRow>();

  for (const student of students) {
    const label = getLabel(student) || 'Unassigned';
    const row = grouped.get(label) ?? {
      label,
      total: 0,
      active: 0,
      deferred: 0,
      attachment: 0,
      completed: 0,
      graduated: 0,
    };

    row.total += 1;
    if (student.lifecycle_status === 'active') row.active += 1;
    if (student.lifecycle_status === 'deferred') row.deferred += 1;
    if (student.lifecycle_status === 'completed') row.completed += 1;
    if (student.lifecycle_status === 'graduated') row.graduated += 1;
    if (student.lifecycle_status === 'active' && student.academic_phase === 'attachment') row.attachment += 1;
    grouped.set(label, row);
  }

  return [...grouped.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

export default async function StudentReportsPage() {
  await requireHodAccess();
  const [summary, students] = await Promise.all([getStudentSummary(), getStudents()]);
  const byProgramme = groupStudents(students, (student) => student.programme?.code ?? 'Unassigned');
  const byCohort = groupStudents(students, (student) => student.current_cohort?.name ?? student.admission_cohort?.name ?? 'Unassigned');

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Student Lifecycle"
        title="Student reports"
        description="Department student census."
        icon={BarChart3}
        context={<Badge variant="neutral">{summary.total} students</Badge>}
        actions={
          <Link
            href="/api/students/reports/export"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"
          >
            <Download className="size-3.5" />
            Export Excel
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="In Class" value={String(summary.inClass)} description="Current students" icon={UserRoundCheck} />
        <MetricCard label="On Attachment" value={String(summary.onAttachment)} description="Active phase" icon={Paperclip} />
        <MetricCard label="Deferred" value={String(summary.deferred)} description="Expected to resume" icon={History} />
        <MetricCard label="Dropped out" value={String(summary.droppedOut)} description="Follow-up" icon={UsersRound} />
        <MetricCard label="Completed" value={String(summary.completed)} description="Awaiting graduation" icon={GraduationCap} />
        <MetricCard label="Graduated" value={String(summary.graduated)} description="Historical" icon={GraduationCap} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-text-primary">By programme</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Programme</th>
                <th className="px-3 py-2.5 font-semibold">Total</th>
                <th className="px-3 py-2.5 font-semibold">Active</th>
                <th className="px-3 py-2.5 font-semibold">Attachment</th>
                <th className="px-3 py-2.5 font-semibold">Deferred</th>
                <th className="px-3 py-2.5 font-semibold">Completed</th>
                <th className="px-3 py-2.5 font-semibold">Graduated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byProgramme.map((row) => (
                <tr key={row.label} className="hover:bg-surface-subtle/60">
                  <td className="px-4 py-2.5 font-semibold text-text-primary">{row.label}</td>
                  <td className="px-3 py-2.5 font-semibold text-text-primary">{row.total}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{row.active}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{row.attachment}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{row.deferred}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{row.completed}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{row.graduated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-text-primary">Current cohort census</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Cohort</th>
                <th className="px-3 py-2.5 font-semibold">Total</th>
                <th className="px-3 py-2.5 font-semibold">Active</th>
                <th className="px-3 py-2.5 font-semibold">Attachment</th>
                <th className="px-3 py-2.5 font-semibold">Deferred</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byCohort.map((row) => (
                <tr key={row.label} className="hover:bg-surface-subtle/60">
                  <td className="px-4 py-2.5 font-semibold text-text-primary">{row.label}</td>
                  <td className="px-3 py-2.5 font-semibold text-text-primary">{row.total}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{row.active}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{row.attachment}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{row.deferred}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
