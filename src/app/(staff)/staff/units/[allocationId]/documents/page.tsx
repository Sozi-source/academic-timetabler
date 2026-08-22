import {
  ArrowLeft,
  BookOpen,
  CalendarCheck2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  PlusCircle,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { requireStaffAllocation } from '@/features/staff-assessment/queries';
import { TeachingDocumentWorkflowControls } from '@/features/teaching-documents/document-workflow-controls';
import {
  isTeachingDocumentReady,
  teachingDocumentKinds,
  teachingDocumentStatusLabel,
  teachingDocumentStatusVariant,
} from '@/features/teaching-documents/domain';
import {
  getActiveTeachingDocumentTemplates,
  getTeachingDocumentsByAllocationIds,
} from '@/features/teaching-documents/queries';
import { getRecordOfWorkContext } from '@/features/teaching-documents/record-of-work-actions';
import { StartTeachingDocumentButton } from '@/features/teaching-documents/start-document-button';

interface PageProps {
  params: Promise<{
    allocationId: string;
  }>;
}

export default async function StaffUnitDocumentsPage({ params }: PageProps) {
  const profile = await requireTrainerAccess();
  const { allocationId } = await params;

  const context = await requireStaffAllocation({
    profileId: profile.id,
    allocationId,
  });

  if (!context) {
    notFound();
  }

  const [templates, documents, rowContext] = await Promise.all([
    getActiveTeachingDocumentTemplates(),
    getTeachingDocumentsByAllocationIds([allocationId]),
    getRecordOfWorkContext(allocationId),
  ]);

  const templateByType = new Map(
    templates.map((template) => [template.documentType, template])
  );

  const currentByType = new Map(
    documents
      .filter((document) => document.status !== 'archived')
      .map((document) => [document.documentType, document])
  );

  const entriesCount = rowContext?.entries.length ?? 0;
  const uniqueWeeksCount = new Set(rowContext?.entries.map((e) => e.weekNumber) ?? []).size;
  const syllabusRate = Math.min(100, Math.round((uniqueWeeksCount / 14) * 100));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Units · Documents"
        title={context.allocation.unitName}
        description={`${context.allocation.cohortName} · ${context.allocation.academicPeriodName}`}
        icon={FileText}
        actions={
          <Link
            href={`/staff/units/${allocationId}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Unit
          </Link>
        }
      />

      {/* SECTION 1: STANDARDISED IMPERIAL COLLEGE TEACHING DOCUMENTS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary">
              Standard Imperial College Teaching Documents
            </h2>
            <p className="text-xs text-text-muted">
              Standardized curriculum structures with dynamic trainer and semester details.
            </p>
          </div>
          <Badge variant="success">Imperial Standard</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {/* Card 1: Course Outline */}
          <Card className="flex flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <BookOpen className="size-4" />
                </span>
                <Badge variant="neutral">Fixed Curriculum</Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">Course Outline</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                Competency outcomes, 14-week topical schedule, 5-component grading breakdown, and references.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <Link
                href={`/staff/units/${allocationId}/documents/course-outline`}
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <Printer className="size-3.5" />
                View & Print Outline
              </Link>
            </div>
          </Card>

          {/* Card 2: Scheme of Work */}
          <Card className="flex flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <FileSpreadsheet className="size-4" />
                </span>
                <Badge variant="neutral">14-Week Plan</Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">Scheme of Work</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                Detailed weekly lesson matrix, learning activities, resources, and assessment strategies.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <Link
                href={`/staff/units/${allocationId}/documents/scheme-of-work`}
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <Printer className="size-3.5" />
                View & Print Scheme
              </Link>
            </div>
          </Card>

          {/* Card 3: Record of Work Covered */}
          <Card className="flex flex-col justify-between p-4 border-primary/40 bg-primary/5">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary text-white p-2">
                  <CalendarCheck2 className="size-4" />
                </span>
                <Badge variant={entriesCount > 0 ? 'success' : 'warning'}>
                  {entriesCount > 0 ? `${syllabusRate}% Delivered` : 'Update Required'}
                </Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">Record of Work Covered</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                Progressively log delivered sessions, student attendance, outcomes, and remarks across the term.
              </p>
              <div className="mt-2 text-[10px] font-semibold text-primary">
                {uniqueWeeksCount} of 14 Weeks Logged ({entriesCount} sessions)
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-primary/20 flex gap-2">
              <Link
                href={`/staff/units/${allocationId}/documents/record-of-work`}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <PlusCircle className="size-3.5" />
                Log Progress
              </Link>
              <Link
                href={`/staff/units/${allocationId}/documents/record-of-work/print`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border-strong bg-white px-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
                title="Print Official Record"
              >
                <Printer className="size-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* SECTION 2: INSTITUTIONAL UPLOADED TEMPLATES & SUBMISSION CONTROLS */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-text-primary">
          Institutional Document Approvals & Revisions
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {teachingDocumentKinds.map((kind) => {
            const template = templateByType.get(kind.value);
            const current = currentByType.get(kind.value);
            const templateReady = isTeachingDocumentReady(
              template?.status ?? null,
              template?.storagePath ?? null
            );

            return (
              <article
                key={kind.value}
                className="rounded-xl border border-border bg-white px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary">
                      {kind.label}
                    </h3>
                    <p className="mt-1 text-[11px] leading-5 text-text-muted">
                      {kind.description}
                    </p>
                  </div>

                  {current ? (
                    <Badge
                      variant={teachingDocumentStatusVariant(current.status)}
                    >
                      {teachingDocumentStatusLabel(current.status)}
                    </Badge>
                  ) : (
                    <Badge variant={templateReady ? 'success' : 'neutral'}>
                      {templateReady
                        ? `Template v${template?.versionNumber}`
                        : 'Template pending'}
                    </Badge>
                  )}
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  {!current ? (
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <p className="text-[10px] text-text-muted">
                        {templateReady
                          ? 'Creates an exact private working copy.'
                          : 'Official template not connected.'}
                      </p>

                      <StartTeachingDocumentButton
                        allocationId={allocationId}
                        documentType={kind.value}
                        disabled={!templateReady}
                      />
                    </div>
                  ) : current.status === 'draft' ? (
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <p className="text-[10px] text-text-muted">
                        Prepare the exact template working copy.
                      </p>

                      <StartTeachingDocumentButton
                        allocationId={allocationId}
                        documentType={kind.value}
                        disabled={!templateReady}
                        label="Prepare"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] text-text-muted">
                          Document v{current.versionNumber}
                          {current.currentRevisionNumber
                            ? ` · revision ${current.currentRevisionNumber}`
                            : ''}
                        </p>

                        <a
                          href={`/api/staff/teaching-documents/${current.id}/template`}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
                        >
                          <Download className="size-3" aria-hidden="true" />
                          Source template
                        </a>
                      </div>

                      <TeachingDocumentWorkflowControls
                        documentId={current.id}
                        status={current.status}
                        storagePath={current.storagePath}
                        reviewNote={current.reviewNote}
                      />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
