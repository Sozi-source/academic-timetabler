import {
  Skeleton,
} from '@/components/ui/skeleton';

export default function TrainerImportLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-[42rem] max-w-full" />
      </div>

      <Skeleton className="h-72 max-w-4xl rounded-2xl" />
    </div>
  );
}