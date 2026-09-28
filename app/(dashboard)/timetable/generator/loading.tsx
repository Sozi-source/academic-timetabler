import {
  Skeleton,
} from '@/components/ui/skeleton';

export default function TimetableGeneratorLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-5 w-[48rem] max-w-full" />
      </div>

      <Skeleton className="h-48 rounded-2xl" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({
          length: 6,
        }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-32 rounded-2xl"
          />
        ))}
      </div>

      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}