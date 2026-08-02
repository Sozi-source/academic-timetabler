import { Skeleton } from '@/components/ui/skeleton';

export default function UnitsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-[42rem] max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-32 rounded-2xl"
          />
        ))}
      </div>

      <Skeleton className="h-[34rem] rounded-2xl" />
    </div>
  );
}