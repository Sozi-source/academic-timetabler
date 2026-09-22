import { Skeleton } from '@/components/ui/skeleton';

export default function TimetableCalendarLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-5 w-[42rem] max-w-full" />
      </div>

      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-11 w-72 rounded-xl" />
      <Skeleton className="h-[28rem] rounded-2xl" />
    </div>
  );
}