import type { Metadata } from 'next';
import { PencilRuler } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
  const periods = (await getAcademicPeriods()).filter(
    (period) =>
      period.academicYear.status === 'active' &&
      (period.status === 'active' || period.status === 'planned'),
  );
  const params = await searchParams;
  const selectedId = params.academicPeriodId ?? periods.find((period) => period.status === 'active')?.id ?? periods[0]?.id ?? null;
  const data = selectedId ? await getTimetableEditorData(selectedId) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Timetable Editor"
        description="Interactive session placement and allocation management."
        actions={
          <form method="get" className="flex items-center gap-2">
            <Select
              id="academicPeriodId"
              name="academicPeriodId"
              defaultValue={selectedId ?? ''}
              className="h-9 min-w-[220px] max-w-[280px] text-xs font-semibold"
            >
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.code} — {period.name}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm" variant="outline">
              Load
            </Button>
          </form>
        }
      />

      {selectedId && data ? (
        <TimetableEditorWorkspace academicPeriodId={selectedId} data={data} />
      ) : (
        <EmptyState
          icon={PencilRuler}
          title="No timetable to review"
          description="No active or planned Academic Period is available."
        />
      )}
    </div>
  );
}
