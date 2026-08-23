import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { CurriculumContentUploadForm } from '@/features/teaching-documents/curriculum-content/upload-form';

export default async function CurriculumContentImportPage() {
  await requireHodAccess();
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Teaching documents"
        title="Import Excel curriculum"
        icon={BookOpenCheck}
        actions={<Link href="/teaching-documents" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-secondary"><ArrowLeft className="size-4" /> Teaching documents</Link>}
      />
      <div className="max-w-5xl"><CurriculumContentUploadForm /></div>
    </div>
  );
}
