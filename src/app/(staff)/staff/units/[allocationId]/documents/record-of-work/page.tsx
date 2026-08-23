import {
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import {
  notFound,
} from 'next/navigation';

import {
  OnlineRecordOfWorkManager,
} from '@/features/teaching-documents/record-of-work-online/manager';
import {
  getOnlineRecordOfWorkContext,
} from '@/features/teaching-documents/record-of-work-online/queries';

interface PageProps {
  params: Promise<{
    allocationId: string;
  }>;
}

export default async function RecordOfWorkPage({
  params,
}: PageProps) {
  const {
    allocationId,
  } =
    await params;

  const context =
    await getOnlineRecordOfWorkContext(
      allocationId,
    );

  if (
    !context
  ) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/staff/units/${allocationId}/documents`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Teaching Documents
      </Link>

      <OnlineRecordOfWorkManager
        context={context}
      />
    </div>
  );
}
