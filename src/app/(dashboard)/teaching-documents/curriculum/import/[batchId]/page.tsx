import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { requireHodAccess } from '@/features/auth/authorization';
import { confirmCurriculumContentImportAction } from '@/features/teaching-documents/curriculum-content/actions';
import { getCurriculumContentImportBatch } from '@/features/teaching-documents/curriculum-content/queries';

export default async function CurriculumContentReviewPage({ params }: { params: Promise<{ batchId:string }> }) {
  await requireHodAccess();
  const { batchId } = await params;
  const batch = await getCurriculumContentImportBatch(batchId);
  if (!batch) notFound();
  const summary = (batch.validation_summary ?? {}) as Record<string,unknown>;
  const documentType = summary.documentType === 'scheme_of_work' ? 'Scheme of Work' : 'Course Outline';

  async function confirm(formData: FormData) {
    'use server';
    await confirmCurriculumContentImportAction(formData);
    redirect('/teaching-documents/curriculum');
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Curriculum content" title={`Review ${documentType} import`} description={batch.original_file_name} icon={BookOpenCheck}
        actions={<Link href="/teaching-documents/curriculum/import" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-secondary"><ArrowLeft className="size-4" /> Upload another</Link>} />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {['families','units','weeks','outcomes'].map((key) => <div key={key} className="rounded-xl border border-border bg-surface p-4"><div className="text-xs uppercase text-text-muted">{key}</div><div className="mt-1 text-2xl font-bold text-text-primary">{String(summary[key] ?? 0)}</div></div>)}
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-text-primary">Ready to import {documentType}</h2>
        <p className="mt-1 text-sm text-text-muted">Academic Planner merges this validated document content into the selected curriculum family/version and maps the official system units to it.</p>
        <form action={confirm} className="mt-4 flex justify-end">
          <input type="hidden" name="batchId" value={batchId} />
          <Button type="submit">Import curriculum content</Button>
        </form>
      </section>
    </div>
  );
}
