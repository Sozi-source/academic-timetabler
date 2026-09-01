import { requireHodAccess } from '@/features/auth/authorization';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { getOperationsSnapshot } from '@/features/operations/queries';

function formatPeriodDisplay(name: string | null | undefined): string {
  if (!name) return 'Sep – Dec 2026';
  return name
    .replace(/September/gi, 'Sep')
    .replace(/December/gi, 'Dec')
    .replace(/January/gi, 'Jan')
    .replace(/February/gi, 'Feb')
    .replace(/March/gi, 'Mar')
    .replace(/April/gi, 'Apr')
    .replace(/August/gi, 'Aug')
    .replace(/October/gi, 'Oct')
    .replace(/November/gi, 'Nov')
    .replace(/[-–—]+/g, ' – ');
}

export default async function DashboardPage() {
  const profile = await requireHodAccess();
  const snapshot = await getOperationsSnapshot().catch(() => null);

  const activePeriod = formatPeriodDisplay(snapshot?.activePeriodName);
  const departmentName = profile.departmentName || 'Human Nutrition & Dietetics';

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <DashboardView
        departmentName={departmentName}
        activePeriodName={activePeriod}
        snapshot={snapshot}
      />
    </div>
  );
}
