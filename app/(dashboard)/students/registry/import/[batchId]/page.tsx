import type { Metadata } from 'next';
import { ArrowLeft, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { StudentImportConfirmation } from '@/features/imports/students/student-import-confirmation';
import { StudentImportPreview } from '@/features/imports/students/student-import-preview';
import { getStudentImportBatch } from '@/features/imports/students/queries';
export const metadata: Metadata = { title: 'Review Student Import' };
export default async function StudentImportReviewPage({ params }: { params: Promise<{batchId:string}> }) {
  await requireHodAccess(); const {batchId}=await params; const result=await getStudentImportBatch(batchId); if(!result) notFound();
  const completed=result.batch.status==='completed'||result.batch.status==='completed_with_errors';
  return <div className="space-y-4"><PageHeader eyebrow="Student Lifecycle" title={completed?'Import results':'Review students'} description="Check resolved programmes, cohorts and exceptions." context={<div className="flex gap-2"><Badge variant="neutral">{result.batch.originalFileName}</Badge><Badge variant={completed?'success':'neutral'}>{result.batch.status.replaceAll('_',' ')}</Badge></div>} actions={<Link href={completed?'/students/registry':'/students/registry/import'} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary"><ArrowLeft className="size-3.5"/>{completed?'Back to registry':'Upload another'}</Link>}/>
  <div className="rounded-xl border border-institutional-yellow/60 bg-institutional-yellow-subtle px-4 py-3"><div className="flex items-center gap-3"><BrainCircuit className="size-4 text-institutional-yellow-ink"/><p className="text-xs font-medium text-text-secondary">Inferred values must match existing programme and cohort records.</p></div></div>
  <StudentImportConfirmation batchId={result.batch.id} validRows={result.batch.validRows} invalidRows={result.batch.invalidRows} duplicateRows={result.batch.duplicateRows} completed={completed}/><StudentImportPreview rows={result.rows}/></div>;
}
