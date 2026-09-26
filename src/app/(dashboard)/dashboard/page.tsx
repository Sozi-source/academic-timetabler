import { requireHodAccess } from '@/features/auth/authorization';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { getOperationsSnapshot } from '@/features/operations/queries';

function formatPeriodDisplay(name: string | null | undefined): string {
  if (!name) return 'September-December 2026';
  return name
    .replace(/\bSept?\b/gi, 'September')
    .replace(/\bDec\b/gi, 'December')
    .replace(/\bJan\b/gi, 'January')
    .replace(/\bFeb\b/gi, 'February')
    .replace(/\bMar\b/gi, 'March')
    .replace(/\bApr\b/gi, 'April')
    .replace(/\bJun\b/gi, 'June')
    .replace(/\bJul\b/gi, 'July')
    .replace(/\bAug\b/gi, 'August')
    .replace(/\bOct\b/gi, 'October')
    .replace(/\bNov\b/gi, 'November')
    .replace(/\s*[-–—]\s*/g, '-');
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
