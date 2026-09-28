import type { Metadata } from 'next';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { StudentImportUploadForm } from '@/features/imports/students/student-import-upload-form';

export const metadata: Metadata = { title: 'Import Students' };
export default async function ImportStudentsPage() {
  await requireHodAccess();
  return <div className="space-y-4"><PageHeader eyebrow="Student Lifecycle" title="Import students" description="Upload and validate the student workbook." context={<span className="inline-flex items-center gap-2 text-xs text-text-muted"><FileSpreadsheet className="size-4"/>Excel import</span>} actions={<Link href="/students/registry" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"><ArrowLeft className="size-3.5"/>Back to registry</Link>}/><div className="max-w-4xl"><StudentImportUploadForm/></div></div>;
}
