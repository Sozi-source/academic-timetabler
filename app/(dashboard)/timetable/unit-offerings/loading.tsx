export default function UnitOfferingsLoading() {
  return (
    <div className="space-y-8">
      <div className="h-36 animate-pulse rounded-2xl bg-surface-subtle" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-border bg-surface-subtle"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-border bg-surface-subtle" />
    </div>
  );
}
