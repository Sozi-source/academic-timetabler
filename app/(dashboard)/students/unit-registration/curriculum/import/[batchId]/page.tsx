import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { CurriculumImportConfirmation } from '@/features/imports/curriculum/curriculum-import-confirmation';
import { CurriculumImportPreview } from '@/features/imports/curriculum/curriculum-import-preview';
import { getCurriculumImportBatch } from '@/features/imports/curriculum/queries';

interface Props {
  params: Promise<{ batchId: string }>;
}

export default async function CurriculumImportReviewPage({ params }: Props) {
  await requireHodAccess();
  const { batchId } = await params;
  const data = await getCurriculumImportBatch(batchId);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Curriculum import"
        title="Review curriculum"
        description={data.batch.originalFileName}
        icon={BookOpenCheck}
        actions={
          <Link href="/students/unit-registration/curriculum/import" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-secondary">
            <ArrowLeft className="size-4" />
            Upload another
          </Link>
        }
      />

      <CurriculumImportConfirmation
        batchId={data.batch.id}
        validRows={data.batch.validRows}
        invalidRows={data.batch.invalidRows}
        duplicateRows={data.batch.duplicateRows}
        batchStatus={data.batch.status}
      />
      <CurriculumImportPreview rows={data.rows} />
    </div>
  );
}
