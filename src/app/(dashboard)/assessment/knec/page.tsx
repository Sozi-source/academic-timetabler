import { Award, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { HodKnecConsole } from '@/features/knec/hod-knec-console';
import { getHodKnecDashboardData } from '@/features/knec/queries';
import { requireHodAccess } from '@/features/auth/authorization';

export const dynamic = 'force-dynamic';

export default async function AssessmentKnecPage() {
  await requireHodAccess();
  const data = await getHodKnecDashboardData();

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="KNEC Examination Booking & Progress"
        description="Track required modules, resits, DNDT/DHNT transitions, exam series registrations, KNEC index numbers, and clearance forms."
        icon={Award}
        actions={
          <Link
            href="/assessment"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <ArrowLeft className="size-3.5 text-slate-500" aria-hidden="true" />
            <span>Assessment Hub</span>
          </Link>
        }
      />

      {!data ? (
        <EmptyState
          icon={Award}
          title="No active department"
          description="Select an active department to manage KNEC series and student progression."
        />
      ) : (
        <HodKnecConsole data={data} />
      )}
    </div>
  );
}
