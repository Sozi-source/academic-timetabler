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
      <OnlineRecordOfWorkManager
        context={context}
      />
    </div>
  );
}
