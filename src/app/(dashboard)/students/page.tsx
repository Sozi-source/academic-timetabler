import { AlertTriangle, BarChart3, CheckCircle2, FileUp, GraduationCap, History, Paperclip, UsersRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getStudentSummary } from '@/features/students/queries';

export default async function StudentsModulePage() {
  await requireHodAccess();
  const summary = await getStudentSummary();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Module 02"
        title="Student Lifecycle"
        description="Department student operations."
        icon={GraduationCap}
        context={<Badge variant="success">Active</Badge>}
        actions={<Button asChild><Link href="/students/registry">Student registry</Link></Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Active" value={String(summary.active)} description="Current" icon={CheckCircle2} />
        <MetricCard label="Attachment" value={String(summary.attachment)} description="Active phase" icon={Paperclip} />
        <MetricCard label="Deferred" value={String(summary.deferred)} description="Expected back" icon={History} />
        <MetricCard label="Dropped out" value={String(summary.droppedOut)} description="Follow-up" icon={AlertTriangle} />
        <MetricCard label="Completed" value={String(summary.completed)} description="Awaiting graduation" icon={GraduationCap} />
        <MetricCard label="Graduated" value={String(summary.graduated)} description="Historical" icon={GraduationCap} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white"><UsersRound className="size-4" /></span>
            <div><p className="text-sm font-bold text-text-primary">Student registry</p><p className="text-xs text-text-muted">{summary.total} records</p></div>
          </div>
          <Link href="/students/registry" className="text-xs font-semibold text-primary hover:underline">Open</Link>
        </Card>

        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink"><FileUp className="size-4" /></span>
            <div><p className="text-sm font-bold text-text-primary">Student onboarding</p><p className="text-xs text-text-muted">Excel import</p></div>
          </div>
          <Link href="/students/registry/import" className="text-xs font-semibold text-primary hover:underline">Open</Link>
        </Card>

        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white"><BarChart3 className="size-4" /></span>
            <div><p className="text-sm font-bold text-text-primary">Student reports</p><p className="text-xs text-text-muted">Census & Excel</p></div>
          </div>
          <Link href="/students/reports" className="text-xs font-semibold text-primary hover:underline">Open</Link>
        </Card>
      </div>
    </div>
  );
}
