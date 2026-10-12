import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shared instant fallback for dashboard routes without their own loading.tsx.
 * Lets sidebar navigation respond immediately while the server renders the page.
 * More specific segment loading.tsx files (e.g. /timetable/*) take precedence.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-3 border-b border-border pb-5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-56" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>

      <Skeleton className="h-[28rem] rounded-2xl" />
    </div>
  );
}
