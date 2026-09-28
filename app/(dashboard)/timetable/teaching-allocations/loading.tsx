import {
  Skeleton,
} from '@/components/ui/skeleton';

export default function TeachingAllocationsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-5 w-[46rem] max-w-full" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-36 rounded-2xl"
          />
        ))}
      </div>

      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}