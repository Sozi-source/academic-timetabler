import { Skeleton } from '@/components/ui/skeleton';

interface ExamControlSkeletonProps {
  /** Number of KPI cards in the top strip (default 4). */
  cards?: number;
  /** Number of table placeholder rows (default 8). */
  rows?: number;
  /** Show an extra filter/toolbar skeleton bar above the table. */
  showToolbar?: boolean;
}

export function ExamControlSkeleton({
  cards = 4,
  rows = 8,
  showToolbar = true,
}: ExamControlSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading Exam Control view"
      className="admin-screen space-y-5"
    >
      {/* PageHeader skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* KPI Strip skeleton */}
      {cards > 0 ? (
        <div
          className={
            cards === 3
              ? 'grid grid-cols-2 gap-3 lg:grid-cols-3'
              : 'grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4'
          }
        >
          {Array.from({ length: cards }).map((_, idx) => (
            <div
              key={idx}
              className="flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-border bg-surface p-3.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="size-6 rounded-md" />
              </div>
              <Skeleton className="mt-3 h-7 w-16" />
            </div>
          ))}
        </div>
      ) : null}

      {/* Toolbar / Filters skeleton */}
      {showToolbar ? (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-9 w-36" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-60 max-w-full" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      ) : null}

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
        <div className="grid grid-cols-[2.5rem_9rem_1fr_8rem_7rem_7rem] items-center gap-3 border-b border-border bg-surface-subtle px-3 py-3">
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="divide-y divide-border-soft">
          {Array.from({ length: rows }).map((_, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[2.5rem_9rem_1fr_8rem_7rem_7rem] items-center gap-3 px-3 py-3"
            >
              <Skeleton className="h-3.5 w-5" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-44 max-w-full" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-14 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
