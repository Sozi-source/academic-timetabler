import { Skeleton } from '@/components/ui/skeleton';

export default function AcademicYearsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-[38rem] max-w-full" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Skeleton className="h-[32rem] rounded-2xl" />

        <div className="space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-[24rem] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}