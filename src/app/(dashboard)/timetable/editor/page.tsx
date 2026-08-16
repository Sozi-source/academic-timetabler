import type { Metadata } from 'next';
import { PencilRuler } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { getAcademicPeriods } from '@/features/academic-periods/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { TimetableEditorWorkspace } from '@/features/timetable-editor/editor-workspace';
import { getTimetableEditorData } from '@/features/timetable-editor/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Timetable Editor',
  description: 'Safely move and lock generated timetable sessions.',
};

export default async function TimetableEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ academicPeriodId?: string }>;
}) {
  await requireHodAccess();
  const periods = (await getAcademicPeriods()).filter((period) => period.status === 'active' || period.status === 'planned');
  const params = await searchParams;
  const selectedId = params.academicPeriodId ?? periods.find((period) => period.status === 'active')?.id ?? periods[0]?.id ?? null;
  const data = selectedId ? await getTimetableEditorData(selectedId) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Step 3 of 4"
        title="Review and edit"
        description="Review the timetable. Move a lesson or change its room only when needed; the system will warn you about clashes."
        actions={<Badge variant="primary"><PencilRuler className="size-3.5" /> Safe editing</Badge>}
      />

      <Card className="p-4">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-text-primary">Academic Period</span>
            <Select id="academicPeriodId" name="academicPeriodId" defaultValue={selectedId ?? ''}>
              {periods.map((period) => <option key={period.id} value={period.id}>{period.code} — {period.name}</option>)}
            </Select>
          </label>
          <Button type="submit">Load timetable</Button>
        </form>
      </Card>

      {selectedId && data ? <TimetableEditorWorkspace academicPeriodId={selectedId} data={data} /> : (
        <EmptyState icon={PencilRuler} title="No timetable to review" description="No active or planned Academic Period is available." />
      )}
    </div>
  );
}
