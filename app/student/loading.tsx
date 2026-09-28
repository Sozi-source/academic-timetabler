import { PortalPageSkeleton } from '@/components/portal/portal-page-skeleton';

export default function StudentPortalLoading() {
  return (
    <div className="academic-portal min-h-screen bg-background px-4 py-4">
      <div className="mx-auto max-w-[29rem]">
        <PortalPageSkeleton />
      </div>
    </div>
  );
}

