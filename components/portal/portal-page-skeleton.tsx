export function PortalPageSkeleton() {
  return (
    <div className="portal-skeleton space-y-4" aria-label="Loading portal page" aria-busy="true">
      <div className="h-20 rounded-xl border border-border bg-surface" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div className="h-28 rounded-xl border border-border bg-surface" />
        <div className="h-28 rounded-xl border border-border bg-surface" />
        <div className="col-span-2 h-28 rounded-xl border border-border bg-surface sm:col-span-1" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(17rem,1fr)]">
        <div className="h-64 rounded-xl border border-border bg-surface" />
        <div className="h-64 rounded-xl border border-border bg-surface" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

