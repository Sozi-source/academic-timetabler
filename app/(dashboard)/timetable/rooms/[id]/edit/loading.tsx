import { Skeleton } from '@/components/ui/skeleton';

export default function EditRoomLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-[40rem] max-w-full" />
      </div>

      <Skeleton className="h-[44rem] max-w-3xl rounded-2xl" />
    </div>
  );
}