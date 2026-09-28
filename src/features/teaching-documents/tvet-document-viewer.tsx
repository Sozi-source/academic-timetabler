'use client';

import Image from 'next/image';
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  FileDown,
  LoaderCircle,
  RotateCcw,
  Send,
  UploadCloud,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  submitTrainerTeachingDocumentAction,
  type TeachingDocumentStatusInfo,
} from './trainer-submission-actions';
import {
  getContiguousTopicSpan,
  normalizeCurriculumLearningOutcomes,
  normalizeWeeklySchedule,
} from './curriculum-content-normalizer';
import {
  parseActivitiesList,
  parseCourseOutlineApproaches,
  parseCourseOutlineSubtopics,
  parseResourcesList,
  parseSLOOutcomes,
  parseSubTopics,
  type TVETCourseOutlineData,
  type TVETRecordOfWorkData,
  type TVETSchemeOfWorkData,
} from './tvet-standards';

interface ViewerProps {
  type: 'course_outline' | 'scheme_of_work' | 'record_of_work';
  allocationId: string;
  courseOutline?: TVETCourseOutlineData;
  schemeOfWork?: TVETSchemeOfWorkData;
  recordOfWork?: TVETRecordOfWorkData;
  initialStatus?: TeachingDocumentStatusInfo | null;
}

function formatStatusTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function TVETDocumentViewer({
  type,
  allocationId,
  courseOutline,
  schemeOfWork,
  recordOfWork,
  initialStatus,
}: ViewerProps) {
  const [statusInfo, setStatusInfo] = useState<TeachingDocumentStatusInfo | null>(
    initialStatus ?? null,
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const header =
    courseOutline?.header ??
    schemeOfWork?.header ??
    recordOfWork?.header;

  if (!header) {
    return <div className="p-4 text-sm text-slate-600">Document details unavailable.</div>;
  }

  const courseOutlineSchedule = normalizeWeeklySchedule(courseOutline?.weeklySchedule ?? []);

  const isDocumentReady =
    type === 'record_of_work'
      ? true
      : type === 'course_outline'
      ? courseOutline?.isAvailable !== false && (courseOutline?.weeklySchedule?.length ?? 0) > 0
      : schemeOfWork?.isAvailable !== false && (schemeOfWork?.plannedWeeks?.length ?? 0) > 0;

  const title =
    type === 'course_outline'
      ? 'COURSE OUTLINE'
      : type === 'scheme_of_work'
        ? 'SCHEME OF WORK'
        : 'RECORD OF WORK COVERED';

  const handleExportWord = async () => {
    if (!isDocumentReady) {
      alert('Word export is disabled: curriculum content for this unit is not yet ready.');
      return;
    }

    try {
      const res = await fetch(
        `/api/teaching-documents/export-word?allocationId=${allocationId}&type=${type}`,
      );
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        type === 'course_outline'
          ? `${header.unitName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Course_Outline.docx`
          : `${header.unitCode}_${type}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Word export is not available yet for this document.');
    }
  };

  const handleSubmitForReview = async () => {
    if (type === 'record_of_work') return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await submitTrainerTeachingDocumentAction({
        allocationId,
        documentType: type,
      });

      if (res.statusInfo) {
        setStatusInfo(res.statusInfo);
      } else {
        setStatusInfo((prev) => ({
          id: prev?.id ?? '',
          allocationId,
          documentType: type,
          status: 'submitted',
          versionNumber: prev?.versionNumber ?? 1,
          currentRevisionNumber: (prev?.currentRevisionNumber ?? 0) + 1,
          submittedRevisionNumber: (prev?.currentRevisionNumber ?? 0) + 1,
          approvedRevisionNumber: null,
          reviewNote: null,
          submittedAt: new Date().toISOString(),
          approvedAt: null,
          returnedAt: null,
          updatedAt: new Date().toISOString(),
        }));
      }

      setSubmitSuccess(res.message);
      setIsConfirmOpen(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Submission failed. Please verify that curriculum syllabus is fully uploaded.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {/* Top Action Bar (Hidden during printing) */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4 print:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-xs font-bold text-slate-900">
            {type === 'course_outline' ? header.unitName : `${header.unitCode} · ${header.unitName}`}
          </span>
          {!isDocumentReady && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300">
              <AlertCircle className="size-3 text-amber-600" />
              Content Pending
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/teaching-documents/curriculum"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary shadow-2xs transition hover:bg-surface-subtle"
            title="Configure college-wide CAT and End-Term assessment dates"
          >
            <CalendarCheck className="size-3.5 text-primary" aria-hidden="true" />
            <span className="sm:hidden">Dates</span>
            <span className="hidden sm:inline">Assessment Schedule</span>
          </Link>

          {type !== 'record_of_work' && isDocumentReady && (
            <Link
              href={`/teaching-documents/curriculum/individual-upload?unitCode=${encodeURIComponent(header.unitCode)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <UploadCloud className="size-3.5 text-slate-600" aria-hidden="true" />
              <span className="sm:hidden">Update</span>
              <span className="hidden sm:inline">Update Document</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleExportWord}
            disabled={!isDocumentReady}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-bold shadow-sm transition ${
              isDocumentReady
                ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
            title={isDocumentReady ? 'Export Word (.docx)' : 'Curriculum content is not yet ready'}
          >
            <FileDown className="size-3.5" aria-hidden="true" />
            <span className="sm:hidden">Word</span>
            <span className="hidden sm:inline">Export Word</span>
          </button>

          {/* Trainer Confirm & Submit Action */}
          {type !== 'record_of_work' && (
            <>
              {statusInfo?.status === 'approved' ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-800 shadow-2xs">
                  <Check className="size-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Approved by HOD</span>
                  <span className="sm:hidden">Approved</span>
                </span>
              ) : statusInfo?.status === 'submitted' ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3.5 text-xs font-bold text-sky-800 shadow-2xs">
                  <Clock className="size-3.5 text-sky-600" />
                  <span className="hidden sm:inline">Submitted · Awaiting HOD</span>
                  <span className="sm:hidden">Submitted</span>
                </span>
              ) : statusInfo?.status === 'returned' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null);
                    setIsConfirmOpen(true);
                  }}
                  disabled={!isDocumentReady || isSubmitting}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
                  title="Resubmit after addressing HOD feedback"
                >
                  <RotateCcw className="size-3.5" />
                  <span className="hidden sm:inline">Resubmit for HOD Review</span>
                  <span className="sm:hidden">Resubmit</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null);
                    setIsConfirmOpen(true);
                  }}
                  disabled={!isDocumentReady || isSubmitting}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-bold text-white shadow-sm transition ${
                    isDocumentReady
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-emerald-300 cursor-not-allowed opacity-60'
                  }`}
                  title={
                    isDocumentReady
                      ? 'Confirm and submit this official document to your HOD for review'
                      : 'Curriculum syllabus must be ready before submission'
                  }
                >
                  <Send className="size-3.5" />
                  <span className="hidden sm:inline">Confirm & Submit for Review</span>
                  <span className="sm:hidden">Submit to HOD</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status Notice Banners (Hidden during printing) */}
      {type !== 'record_of_work' && (
        <div className="space-y-3 print:hidden">
          {submitSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-medium text-emerald-900 shadow-2xs">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {statusInfo?.status === 'approved' && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 text-xs text-emerald-950 shadow-2xs">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-950 text-sm">
                  Verified & Approved by Head of Department
                </p>
                <p className="mt-1 text-emerald-800 leading-relaxed">
                  Approved on {formatStatusTimestamp(statusInfo.approvedAt)}. This official document is locked and will be bundled into the Quality Assurance (QA) examination export pack.
                </p>
              </div>
            </div>
          )}

          {statusInfo?.status === 'submitted' && (
            <div className="flex items-start gap-3 rounded-xl border border-sky-300 bg-sky-50/90 p-4 text-xs text-sky-950 shadow-2xs">
              <Clock className="size-5 shrink-0 text-sky-600 mt-0.5" />
              <div>
                <p className="font-bold text-sky-950 text-sm">
                  Submitted for HOD Review & Verification
                </p>
                <p className="mt-1 text-sky-800 leading-relaxed">
                  Submitted on {formatStatusTimestamp(statusInfo.submittedAt)} (Revision {statusInfo.submittedRevisionNumber ?? 1}). Your Head of Department has received this file in their review queue. You will see approval status updated here once reviewed.
                </p>
              </div>
            </div>
          )}

          {statusInfo?.status === 'returned' && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 shadow-2xs">
              <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-amber-950 text-sm">
                  Returned by Head of Department for Correction
                </p>
                {statusInfo.reviewNote && (
                  <div className="mt-2 rounded-lg border border-amber-300 bg-white p-3 text-xs font-medium text-amber-900 shadow-2xs">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-amber-700 block mb-1">
                      HOD Feedback Note:
                    </span>
                    {statusInfo.reviewNote}
                  </div>
                )}
                <p className="mt-2 text-amber-800">
                  Please update the curriculum as requested, then click <strong>Resubmit for HOD Review</strong> above.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm & Submit Modal */}
      {type !== 'record_of_work' && (
        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mb-2">
                <Send className="size-5" />
              </div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {statusInfo?.status === 'returned'
                  ? 'Resubmit Document for HOD Review'
                  : 'Confirm & Submit to HOD'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                Please confirm that the curriculum topics, schedule, and assessment milestones for this unit are accurate before submission.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-medium shrink-0">Unit:</span>
                <span className="font-bold text-slate-800 text-right truncate">
                  {header.unitCode} — {header.unitName}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-medium shrink-0">Cohort / Class:</span>
                <span className="font-semibold text-slate-800 truncate">{header.cohortName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-medium shrink-0">Document Type:</span>
                <span className="font-semibold text-slate-800">{title}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-medium shrink-0">Contact Hours:</span>
                <span className="text-slate-700">
                  {header.weeklyHours} hrs/wk ({header.totalNominalHours} hrs total)
                </span>
              </div>
            </div>

            {statusInfo?.status === 'returned' && statusInfo.reviewNote && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                <p className="font-bold text-[10px] uppercase tracking-wider text-amber-700">Addressed HOD Feedback:</p>
                <p className="mt-0.5 italic">&quot;{statusInfo.reviewNote}&quot;</p>
              </div>
            )}

            {submitError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-900 font-medium">
                {submitError}
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Upon submission, an official DOCX will be compiled, sealed, archived in private storage, and placed in the HOD review queue for verification.
            </p>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmitForReview}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin mr-1.5" />
                    Submitting...
                  </>
                ) : statusInfo?.status === 'returned' ? (
                  'Confirm & Resubmit Now'
                ) : (
                  'Confirm & Submit Now'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Printable Document Container (Professional Academic Layout) */}
      <div className="mx-auto min-w-0 max-w-5xl overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md print:m-0 print:max-w-none print:overflow-visible print:border-none print:shadow-none">

        {/* ── OFFICIAL ACADEMIC HEADER ── */}
        <div className="border-b-2 border-slate-900 bg-white px-4 py-5 text-center sm:px-8 sm:py-6 print:px-6 print:py-4">
          <div className="mx-auto flex flex-col items-center justify-center space-y-2">
            {/* Official Center Crest / Logo Emblem */}
            <div className="mb-1 flex items-center justify-center">
              <Image
                src="/branding/icmhs-logo.png"
                alt="Imperial College Logo"
                width={80}
                height={80}
                priority
                className="h-16 w-auto object-contain mx-auto print:h-14"
              />
            </div>

            {/* Institution & Department */}
            <div>
              <h1 className="text-base font-black tracking-wide text-slate-900 uppercase sm:text-2xl sm:tracking-wider print:text-black">
                {header.institutionName}
              </h1>
              <p className="mt-0.5 text-xs font-bold tracking-widest text-slate-700 uppercase print:text-black">
                Department of {header.departmentName}
              </p>
              <div className="mt-2.5 inline-block rounded-md border-2 border-slate-900 bg-slate-100 px-4 py-0.5 text-[11px] font-black tracking-widest text-slate-900 uppercase print:border-black print:bg-slate-100 print:text-black">
                {title}
              </div>
            </div>
          </div>
        </div>

        {/* ── CONSPICUOUS UNIT NAME BANNER ── */}
        <div className="border-b-2 border-slate-900 bg-slate-100 px-4 py-3 text-center sm:px-8 sm:py-3.5 print:bg-slate-50 print:border-black">
          <p className="text-[10px] font-bold tracking-widest text-slate-600 uppercase">Curriculum Unit</p>
          <h2 className="text-sm font-black tracking-wide text-slate-900 uppercase sm:text-xl print:text-black">
            {type === 'course_outline' ? header.unitName : `${header.unitCode} — ${header.unitName}`}
          </h2>
        </div>

        {/* ── CONTEXT MATRIX (HIGH-CONTRAST MONOCHROME-SAFE GRID) ── */}
        <div className="grid grid-cols-2 gap-0 border-b-2 border-slate-900 bg-slate-50 text-xs sm:grid-cols-4 print:border-black">
          {(type === 'course_outline'
            ? [
                { label: 'Curriculum Unit', value: header.unitName },
                { label: 'Trainer', value: header.trainerName },
                { label: 'Academic Period', value: header.academicPeriodName },
                { label: 'Contact Hours', value: `${header.weeklyHours} hrs/wk · ${header.totalNominalHours} hrs total` },
                { label: 'Standard Status', value: 'APPROVED', highlight: true },
                { label: 'Delivery Duration', value: '14 Weeks' },
                { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
                { label: 'Document Type', value: title },
              ]
            : [
                { label: 'Cohort / Class', value: header.cohortName },
                { label: 'Trainer', value: header.trainerName },
                { label: 'Academic Period', value: header.academicPeriodName },
                { label: 'Contact Hours', value: `${header.weeklyHours} hrs/wk · ${header.totalNominalHours} hrs total` },
                { label: 'Standard Status', value: 'APPROVED', highlight: true },
                { label: 'Delivery Duration', value: '14 Weeks' },
                { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
                { label: 'Document Type', value: title },
              ]
          ).map(({ label, value, highlight }) => (
            <div key={label} className="min-w-0 border-r border-b border-slate-300 px-3 py-2 sm:px-4 sm:py-2.5 last:border-r-0 print:border-slate-800">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
              <span className={`mt-0.5 block font-bold ${highlight ? 'text-slate-900 font-black' : 'text-slate-900'}`}>{value}</span>
            </div>
          ))}
        </div>

        <div className="p-3 sm:p-8 print:p-6">

          {/* ════════════════════════════════ COURSE OUTLINE ════════════════════════════════ */}
          {type === 'course_outline' && courseOutline && (
            !isDocumentReady ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-xs">
                  <div className="flex items-start gap-3.5">
                    <AlertCircle className="size-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="font-bold text-sm text-amber-950 uppercase tracking-wide">
                        Curriculum Content Not Yet Ready
                      </h3>
                      <p className="text-xs leading-relaxed text-amber-900">
                        {courseOutline.notReadyMessage ||
                          `The official curriculum course outline for ${header.unitCode} (${header.unitName}) has not yet been ingested. Broken or unverified content has been purged in accordance with institutional policy.`}
                      </p>
                      <div className="pt-2 text-[11px] text-amber-800 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span>
                          <strong>Status:</strong> Awaiting official TVET syllabus document upload (DOCX/PDF).
                        </span>
                        <span>Please provide the authentic syllabus to the Head of Department (HOD) for automated ingestion.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-xs text-slate-900">
                <section>
                  <SectionHeading number="1" title="Unit Description & Overall Purpose" />
                  <p className="mt-2.5 leading-relaxed text-justify text-slate-800">
                    {courseOutline.unitDescription || '—'}
                  </p>
                </section>

              <section>
                <SectionHeading number="2" title="Summary of Learning Outcomes (Core Competencies)" />
                <ul className="mt-2.5 space-y-1.5 text-slate-800">
                  {normalizeCurriculumLearningOutcomes(courseOutline.learningOutcomes).map((lo, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 mt-0.5 flex size-4 items-center justify-center rounded border border-slate-900 bg-slate-100 text-[10px] font-black text-slate-900">{i + 1}</span>
                      <span className="leading-relaxed">{lo}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <SectionHeading number="3" title="Weekly Delivery & Topical Breakdown" />
                <div className="mt-3 overflow-x-auto overscroll-x-contain rounded border border-slate-300 print:overflow-visible">
                <table className="w-full min-w-[44rem] border-collapse text-[11px] table-fixed print:min-w-0">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-900">
                      <th className="border border-slate-300 px-2 py-2 text-center w-[8%] font-black uppercase text-[9px] tracking-wider text-slate-900">Week</th>
                      <th className="border border-slate-300 px-3 py-2 text-left w-[32%] font-black uppercase text-[9px] tracking-wider text-slate-900">Topic Title</th>
                      <th className="border border-slate-300 px-3 py-2 text-left w-[52%] font-black uppercase text-[9px] tracking-wider text-slate-900">Content / Sub-topics to be Covered</th>
                      <th className="border border-slate-300 px-2 py-2 text-center w-[8%] font-black uppercase text-[9px] tracking-wider text-slate-900">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseOutlineSchedule.map((sched, idx) => {
                      const allSubtopics = parseCourseOutlineSubtopics(sched.subTopics);
                      const topicSpan = getContiguousTopicSpan(courseOutlineSchedule, idx);

                      return (
                        <tr key={sched.weekNumber} className={idx % 2 === 0 ? 'bg-white align-top' : 'bg-slate-50 align-top'}>
                          <td className="border border-slate-300 px-2 py-2 text-center font-black text-slate-900">
                            W{sched.weekNumber}
                          </td>
                          {topicSpan.isStart && (
                            <td
                              rowSpan={topicSpan.rowSpan}
                              className="border border-slate-300 px-3 py-2 align-middle font-bold text-slate-900 leading-snug bg-white"
                            >
                              {sched.topicTitle}
                            </td>
                          )}
                          <td className="border border-slate-300 px-3 py-2 text-slate-800 leading-relaxed">
                            {allSubtopics.length > 0 ? (
                              <ul className="m-0 space-y-1.5 p-0">
                                {allSubtopics.map((sub, sIdx) => (
                                  <li key={sIdx} className="block leading-snug">
                                    <span className="font-bold text-slate-900">• </span>
                                    <span>{sub.trim()}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-slate-400 italic">• Core topic mastery and practical coverage.</span>
                            )}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-800">
                            {sched.hours} hrs
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </section>

              <section>
                <SectionHeading number="4" title="Teaching / Learning and Assessment Approaches" />
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
                    <p className="font-black text-slate-900 text-[11px] mb-2">Teaching / Learning Approaches</p>
                    <ul className="space-y-1.5 text-slate-800">
                      {parseCourseOutlineApproaches(
                        courseOutline.teachingLearningApproaches ||
                          'Interactive lectures and illustrated tutorials, Guided classroom discussions and seminar presentations, Practical laboratory demonstrations and hands-on exercises, Small-group problem-solving and case studies, Supervised assignments and self-directed study',
                      ).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="shrink-0 text-slate-900 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
                    <p className="font-black text-slate-900 text-[11px] mb-2">Assessment Approaches & Weighting</p>
                    <ul className="space-y-1.5 text-slate-800">
                      {parseCourseOutlineApproaches(
                        courseOutline.assessmentApproaches ||
                          'Continuous Assessment Tests (CATs) — 30%\nPractical Assignments, Laboratory Reports & Logbooks — 20%\nEnd-of-Term Summative Examination — 50%',
                      ).map((line, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="shrink-0 text-slate-900 font-bold">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeading number="5" title="Instructional Resources & References" />
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
                    <p className="font-black text-slate-900 text-[11px] mb-2">Prescribed References & Textbooks</p>
                    {courseOutline.references.length === 0 ? (
                      <p className="text-slate-600 italic leading-relaxed">• Prescribed curriculum textbooks, clinical manuals, and official departmental handouts.</p>
                    ) : (
                      <ul className="space-y-1.5 text-slate-800">
                        {courseOutline.references.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="shrink-0 text-slate-900 font-bold">•</span>
                            <span>{r.replace(/^[\s\d.)(\]\[•·▪●◦\-–—]+/, '').trim()}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
                    <p className="font-black text-slate-900 text-[11px] mb-2">Instructional Equipment & Safety Materials</p>
                    <ul className="space-y-1.5 text-slate-800">
                      {parseCourseOutlineApproaches(
                        courseOutline.instructionalEquipment.length > 0
                          ? courseOutline.instructionalEquipment.join(', ')
                          : 'Whiteboard & dry-erase markers, Multimedia LCD projector and computer aids, Personal protective equipment (PPE) and clinical laboratory gear, Standard TVET training manuals and reference charts',
                      ).map((e, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="shrink-0 text-slate-900 font-bold">•</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          ))}

          {/* ════════════════════════════════ SCHEME OF WORK ════════════════════════════════ */}
          {type === 'scheme_of_work' && schemeOfWork && (
            !isDocumentReady ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-xs">
                  <div className="flex items-start gap-3.5">
                    <AlertCircle className="size-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="font-bold text-sm text-amber-950 uppercase tracking-wide">
                        Scheme of Work Not Yet Ready
                      </h3>
                      <p className="text-xs leading-relaxed text-amber-900">
                        {schemeOfWork.notReadyMessage ||
                          `The official 14-week scheme of work for ${header.unitCode} (${header.unitName}) has not yet been ingested. Broken or unverified content has been purged in accordance with institutional policy.`}
                      </p>
                      <div className="pt-2 text-[11px] text-amber-800 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span>
                          <strong>Status:</strong> Awaiting official TVET syllabus document upload (DOCX/PDF).
                        </span>
                        <span>Weekly delivery schedule, specific learning outcomes, and assessment milestones will appear once the curriculum document is uploaded.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto overscroll-x-contain rounded border border-slate-300 print:overflow-visible">
              <table className="w-full min-w-[62rem] border-collapse text-[10px] table-fixed print:min-w-0">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-900">
                    <th className="border border-slate-300 px-2 py-2 text-center w-[4%] font-black uppercase text-[9px] tracking-wider text-slate-900">Wk</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-left w-[21%] font-black uppercase text-[9px] tracking-wider text-slate-900">Topic & Sub-topics</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-left w-[26%] font-black uppercase text-[9px] tracking-wider text-slate-900">Specific Learning Outcomes (SLOs)</th>
                    <th className="border border-slate-300 px-2 py-2 text-left w-[16%] font-black uppercase text-[9px] tracking-wider text-slate-900">Activities & Methodology</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-left w-[18%] font-black uppercase text-[9px] tracking-wider text-slate-900">Instructional Resources</th>
                    <th className="border border-slate-300 px-2 py-2 text-left w-[15%] font-black uppercase text-[9px] tracking-wider text-slate-900 whitespace-nowrap">Assessment & Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {schemeOfWork.plannedWeeks.map((w, idx) => {
                    const isMilestone =
                      Boolean(w.assessmentAndRemarks) &&
                      (w.assessmentAndRemarks.toLowerCase().includes('cat') ||
                        w.assessmentAndRemarks.toLowerCase().includes('exam'));

                    const subtopics = parseSubTopics(w.subTopics);
                    const activities = parseActivitiesList(w.learningActivities);
                    const resources = parseResourcesList(w.resourcesAndReferences);

                    return (
                      <tr
                        key={w.weekNumber}
                        className={
                          isMilestone
                            ? 'bg-amber-50/40 align-top'
                            : idx % 2 === 0
                            ? 'bg-white align-top'
                            : 'bg-slate-50 align-top'
                        }
                      >
                        <td className="border border-slate-300 px-2 py-2 text-center font-black text-slate-900">
                          {w.weekNumber}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-2">
                          <div className="font-bold text-slate-900 leading-snug">{w.topic}</div>
                          {subtopics.length > 0 ? (
                            <ul className="mt-1.5 space-y-1 text-[9px] text-slate-700">
                              {subtopics.map((sub, sIdx) => (
                                <li key={sIdx} className="flex items-start gap-1.5 leading-snug">
                                  <span className="shrink-0 text-slate-900 font-bold">•</span>
                                  <span className="break-words">{sub}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 italic text-[9px]">—</span>
                          )}
                        </td>
                        {/* SLOs: bold preamble followed by individual bullet lines */}
                        <td className="border border-slate-300 px-2.5 py-2 text-slate-800 leading-relaxed">
                          <SLOBullets text={w.specificLearningOutcomes} />
                        </td>
                        {/* Activities: each activity on a new line */}
                        <td className="border border-slate-300 px-2 py-2 text-slate-800 leading-relaxed">
                          {activities.length > 0 ? (
                            <ul className="space-y-1 text-[9px] text-slate-800">
                              {activities.map((act, aIdx) => (
                                <li key={aIdx} className="flex items-start gap-1.5 leading-snug">
                                  <span className="shrink-0 text-slate-900 font-bold">•</span>
                                  <span className="break-words">{act}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        {/* Resources: each resource on a new line, widened column */}
                        <td className="border border-slate-300 px-2.5 py-2 text-slate-800 leading-relaxed">
                          {resources.length > 0 ? (
                            <ul className="space-y-1 text-[9px] text-slate-800">
                              {resources.map((res, rIdx) => (
                                <li key={rIdx} className="flex items-start gap-1.5 leading-snug">
                                  <span className="shrink-0 text-slate-900 font-bold">•</span>
                                  <span className="break-words">{res}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        {/* Assessment & Remarks: with college scheduled dates */}
                        <td className="border border-slate-300 px-2 py-2 text-slate-800 leading-relaxed">
                          {w.assessmentAndRemarks ? (
                            <div className="space-y-1">
                              <span
                                className={
                                  isMilestone
                                    ? 'inline-block rounded border border-amber-300 bg-amber-100/80 px-1.5 py-0.5 font-bold text-amber-950 text-[9px] leading-tight'
                                    : 'font-medium text-[9px] leading-tight text-slate-800'
                                }
                              >
                                {w.assessmentAndRemarks.split('\n')[0]}
                              </span>
                              {w.assessmentAndRemarks.includes('Date:') && (
                                <div className="text-[8.5px] font-bold text-amber-900 flex items-center gap-1">
                                  <span>📅</span>
                                  <span>{w.assessmentAndRemarks.split('Date:')[1]?.trim()}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          ))}

          {/* ════════════════════════════════ RECORD OF WORK ════════════════════════════════ */}
          {type === 'record_of_work' && recordOfWork && (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-4 py-2.5 text-xs">
                <span className="font-bold text-slate-700">
                  Progress: <strong className="text-slate-900">{recordOfWork.completedWeeksCount} of {recordOfWork.totalPlannedWeeks} Weeks Delivered</strong>
                </span>
                <span className="font-black text-slate-900">
                  {recordOfWork.syllabusCompletionRate}% Delivered
                </span>
              </div>

              <div className="overflow-x-auto overscroll-x-contain rounded border border-slate-300 print:overflow-visible">
              <table className="w-full min-w-[52rem] border-collapse text-[10px] table-fixed print:min-w-0">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-900">
                    <th className="border border-slate-300 px-2 py-2 text-center w-[5%] font-black uppercase text-[9px] tracking-wider text-slate-900">Wk</th>
                    <th className="border border-slate-300 px-2 py-2 w-[12%] font-black uppercase text-[9px] tracking-wider text-slate-900">Date</th>
                    <th className="border border-slate-300 px-2 py-2 w-[28%] font-black uppercase text-[9px] tracking-wider text-slate-900">Work Covered / Activities</th>
                    <th className="border border-slate-300 px-2 py-2 w-[28%] font-black uppercase text-[9px] tracking-wider text-slate-900">Specific Outcomes Achieved</th>
                    <th className="border border-slate-300 px-2 py-2 w-[11%] font-black uppercase text-[9px] tracking-wider text-slate-900">Attendance</th>
                    <th className="border border-slate-300 px-2 py-2 w-[10%] font-black uppercase text-[9px] tracking-wider text-slate-900">Remarks</th>
                    <th className="border border-slate-300 px-2 py-2 w-[6%] text-center font-black uppercase text-[9px] tracking-wider text-slate-900">Sign</th>
                  </tr>
                </thead>
                <tbody>
                  {recordOfWork.entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                        No entries logged yet.
                      </td>
                    </tr>
                  ) : (
                    recordOfWork.entries.map((entry, idx) => (
                      <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white align-top' : 'bg-slate-50 align-top'}>
                        <td className="border border-slate-300 px-2 py-2 text-center font-black text-slate-900 print:border-slate-800">
                          W{entry.weekNumber}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 font-medium text-slate-700 whitespace-nowrap print:border-slate-800">
                          {entry.sessionDate}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 font-bold text-slate-900 leading-relaxed print:border-slate-800">
                          {entry.workCovered}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-slate-800 leading-relaxed print:border-slate-800">
                          {entry.outcomesAchieved}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-slate-700 print:border-slate-800">
                          {entry.attendanceSummary}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-slate-600 text-[9px] leading-relaxed print:border-slate-800">
                          {entry.remarks}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-center font-bold text-[9px] text-slate-900 print:border-slate-800">
                          {entry.trainerSignature.split(' ')[0] || 'Signed'}
                          <div className="text-[8px] text-slate-500">{new Date(entry.signedAt).toLocaleDateString('en-GB')}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* ── INSTITUTIONAL SIGN-OFF BLOCK ── */}
          <div className="mt-10 border-t-2 border-slate-900 pt-6 text-xs print:border-black">
            <div className="grid gap-8 sm:grid-cols-3">
              {[
                { role: 'Trainer Sign-off', name: header.trainerName },
                { role: 'Head of Department (HOD)', name: 'Signature & Official Stamp' },
                { role: 'Quality Assurance Verification', name: 'Institutional Audit Stamp' },
              ].map(({ role, name }) => (
                <div key={role}>
                  <p className="text-[9px] font-black tracking-widest uppercase text-slate-900">{role}</p>
                  <div className="mt-8 border-b-2 border-slate-900 print:border-black" />
                  <p className="mt-1 font-bold text-slate-800">{name}</p>
                  <p className="text-[10px] text-slate-500">Date: ________________________</p>
                </div>
              ))}
            </div>
          </div>

        </div>{/* /p-8 */}
      </div>
    </div>
  );
}

/** Styled section heading used across Course Outline sections */
function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-1.5 print:border-black">
      <span className="flex size-5 shrink-0 items-center justify-center rounded border border-slate-900 bg-slate-100 text-[10px] font-black text-slate-900">
        {number}
      </span>
      <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-900 print:text-black">{title}</h2>
    </div>
  );
}

/**
 * Renders a Specific Learning Outcomes string as individual bullet lines.
 * Starts with bold TVET standard lead-in: "By the end of the lesson/topic, the trainee should be able to:"
 * followed by each outcome on its own discrete line.
 */
export function SLOBullets({ text }: { text?: string | null }) {
  if (!text || !text.trim()) return <span className="text-slate-400 italic">—</span>;

  const outcomes = parseSLOOutcomes(text);

  if (outcomes.length === 0) {
    return <span className="text-slate-400 italic">—</span>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-bold text-slate-900 leading-tight">
        By the end of the lesson/topic, the trainee should be able to:
      </p>
      <ul className="space-y-1 text-[9px] text-slate-800">
        {outcomes.map((lo, i) => (
          <li key={i} className="flex items-start gap-1.5 leading-snug">
            <span className="shrink-0 text-slate-900 font-bold">•</span>
            <span className="break-words">{lo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
