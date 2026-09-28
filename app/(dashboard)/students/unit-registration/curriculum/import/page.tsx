import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { CurriculumImportUploadForm } from '@/features/imports/curriculum/curriculum-import-upload-form';

export default async function CurriculumImportPage() {
  await requireHodAccess();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Unit registration"
        title="Import curriculum"
        description="Build the authoritative Programme → Stage → Unit structure."
        icon={BookOpenCheck}
        actions={
          <Link href="/students/unit-registration/stages" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-secondary">
            <ArrowLeft className="size-4" />
            Academic stages
          </Link>
        }
      />
      <div className="max-w-5xl">
        <CurriculumImportUploadForm />
      </div>
    </div>
  );
}
