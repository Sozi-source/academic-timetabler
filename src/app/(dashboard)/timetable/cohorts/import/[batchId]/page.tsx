import type { Metadata } from 'next';

import {
  MasterDataImportReviewPage,
} from '@/features/imports/master-data/master-data-import-review-page';

export const metadata: Metadata = {
  title: 'Review Cohort Import',
};

export default async function CohortImportReviewRoute({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;

  return (
    <MasterDataImportReviewPage
      entity="cohorts"
      batchId={batchId}
    />
  );
}
