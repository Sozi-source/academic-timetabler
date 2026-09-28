import {
  Skeleton,
} from '@/components/ui/skeleton';

export default function TeachingAllocationImportLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-10 w-96 max-w-full" />
        <Skeleton className="h-5 w-[46rem] max-w-full" />
      </div>

      <Skeleton className="h-72 max-w-4xl rounded-2xl" />
    </div>
  );
}