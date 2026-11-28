'use client';

import Link from 'next/link';
import { useActionState, useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  Printer,
  RefreshCw,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  submitStudentKnecBookingAction,
  type StudentKnecBookingActionState,
} from './student-actions';
import type { KnecBookingFormContext, KnecExamSeriesItem, StudentKnecSummary } from './types';
import { KnecBookingFormPreview } from './booking-form-preview';

interface StudentKnecBookingClientProps {
  summary: StudentKnecSummary;
  openSeries: KnecExamSeriesItem[];
  latestFormContext: KnecBookingFormContext | null;
}

const initialActionState: StudentKnecBookingActionState = {
  status: 'idle',
  message: null,
};

function moduleBadgeVariant(status: string) {
  if (status === 'completed') return 'success' as const;
  if (status === 'booked') return 'institutional' as const;
  if (status === 'resit') return 'warning' as const;
  return 'neutral' as const;
}

function moduleStatusLabel(status: string) {
  if (status === 'completed') return 'Completed';
  if (status === 'booked') return 'Booked';
  if (status === 'resit') return 'Resit Required';
  if (status === 'exempt') return 'Exempt';
  return 'Pending';
}

function bookingStatusBadge(status: string) {
  if (status === 'results_recorded' || status === 'registered_knec' || status === 'hod_cleared') {
    return 'success' as const;
  }
  if (status === 'submitted' || status === 'sat') return 'institutional' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'neutral' as const;
}

function bookingStatusLabel(status: string) {
  switch (status) {
    case 'submitted':
      return 'Submitted · Print for Signoff';
    case 'hod_cleared':
      return 'HOD Cleared';
    case 'registered_knec':
      return 'Registered with KNEC';
    case 'sat':
      return 'Sat Examination';
    case 'results_recorded':
      return 'Results Recorded';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function StudentKnecBookingClient({
  summary,
  openSeries,
  latestFormContext,
}: StudentKnecBookingClientProps) {
  const formHeadingId = useId();
  const seriesSelectId = useId();
  const notesInputId = useId();

  const [state, formAction, isPending] = useActionState(
    submitStudentKnecBookingAction,
    initialActionState,
  );

  const bookableModules = useMemo(
    () =>
      summary.modules.filter(
        (m) => m.status !== 'completed' && m.status !== 'exempt' && m.module.papers.length > 0,
      ),
    [summary.modules],
  );

  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(openSeries[0]?.id ?? '');
  const [selectedPapers, setSelectedPapers] = useState<string[]>(() => {
    const firstPending = bookableModules.find((m) => m.status === 'resit' || m.status === 'pending');
    if (!firstPending) return [];
    if (firstPending.status === 'resit' && firstPending.resitPaperCodes.length > 0) {
      return [...firstPending.resitPaperCodes];
    }
    return firstPending.module.papers.map((p) => p.paperCode);
  });
  const [previewBookingId, setPreviewBookingId] = useState<string>(
    latestFormContext?.booking.id ?? summary.bookings[0]?.id ?? '',
  );

  const activePreviewContext = useMemo<KnecBookingFormContext | null>(() => {
    const activeList = summary.bookings.filter((b) => b.bookingStatus !== 'cancelled');
    const chosen =
      activeList.find((b) => b.id === previewBookingId) ??
      latestFormContext?.booking ??
      activeList[0];
    if (!chosen) return null;

    const moduleMeta = new Map(
      summary.modules.map((m) => [
        m.module.id,
        { code: m.module.moduleCode, title: m.module.title, order: m.module.sequenceOrder },
      ]),
    );
    const grouped = new Map<
      string,
      {
        moduleCode: string;
        moduleTitle: string;
        order: number;
        papers: Array<{
          paperCode: string;
          paperName: string;
          isResit: boolean;
          paperStatus: typeof chosen.papers[number]['paperStatus'];
        }>;
      }
    >();

    for (const p of chosen.papers) {
      if (p.paperStatus === 'cancelled') continue;
      const meta = moduleMeta.get(p.moduleId);
      const code = meta?.code ?? p.moduleCode;
      const group = grouped.get(code) ?? {
        moduleCode: code,
        moduleTitle: meta?.title ?? `Module ${code}`,
        order: meta?.order ?? 99,
        papers: [],
      };
      group.papers.push({
        paperCode: p.paperCode,
        paperName: p.paperName,
        isResit: p.isResit,
        paperStatus: p.paperStatus,
      });
      grouped.set(code, group);
    }

    return {
      student: {
        id: summary.studentId,
        fullName: summary.fullName,
        admissionNumber: summary.admissionNumber,
        programmeCode: summary.programmeCode,
        programmeName: summary.programmeName,
        equivalentTrackLabel: summary.equivalentTrackLabel,
        departmentName: summary.departmentName,
        cohortName: summary.cohortName,
        knecIndexNumber: chosen.knecIndexNumber ?? summary.knecIndexNumber,
      },
      booking: chosen,
      modulesSummary: Array.from(grouped.values()).sort((a, b) => a.order - b.order),
    };
  }, [latestFormContext?.booking, previewBookingId, summary]);

  const activeSelectedSeries = useMemo(
    () => openSeries.find((s) => s.id === selectedSeriesId) ?? openSeries[0] ?? null,
    [openSeries, selectedSeriesId],
  );

  const existingOpenBooking = useMemo(
    () =>
      activeSelectedSeries
        ? summary.bookings.find((b) => b.seriesId === activeSelectedSeries.id && b.bookingStatus !== 'cancelled')
        : undefined,
    [activeSelectedSeries, summary.bookings],
  );

  const isLockedSeriesBooking = Boolean(
    existingOpenBooking &&
      ['hod_cleared', 'registered_knec', 'sat', 'results_recorded'].includes(
        existingOpenBooking.bookingStatus,
      ),
  );

  const missingProfileFields = summary.missingProfileFields ?? [];
  const moduleOnePaperCodes = useMemo(
    () =>
      new Set(
        summary.modules
          .filter((m) => m.module.moduleNumber === 1)
          .flatMap((m) => m.module.papers.map((p) => p.paperCode)),
      ),
    [summary.modules],
  );
  const hasSelectedModuleOne = useMemo(
    () => selectedPapers.some((code) => moduleOnePaperCodes.has(code)),
    [moduleOnePaperCodes, selectedPapers],
  );
  const isBlockedByMissingProfile = hasSelectedModuleOne && missingProfileFields.length > 0;

  function togglePaper(code: string) {
    setSelectedPapers((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
  }

  function selectWholeModule(modulePapers: string[]) {
    setSelectedPapers((prev) => {
      const allSelected = modulePapers.every((c) => prev.includes(c));
      if (allSelected) {
        return prev.filter((c) => !modulePapers.includes(c));
      }
      return Array.from(new Set([...prev, ...modulePapers]));
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Overview */}
      <Card className="p-4 sm:p-5 border-border shadow-2xs print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Award className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-text-primary">
                KNEC Examination Booking &amp; Progress
              </h1>
              <p className="text-xs text-text-muted mt-0.5">{summary.equivalentTrackLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={summary.overallStatus === 'completed' ? 'success' : 'institutional'}>
              {summary.completedCount} / {summary.requiredCount} Modules Completed ({summary.completionPercent}%)
            </Badge>
            {summary.knecIndexNumber ? (
              <Badge variant="neutral">KNEC Index: {summary.knecIndexNumber}</Badge>
            ) : null}
          </div>
        </div>

        {/* Module Roadmap Strip */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.modules.map((item) => (
            <div
              key={item.module.id}
              className="rounded-xl border border-border bg-surface-subtle/60 p-3 flex flex-col justify-between gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold text-text-primary">{item.module.moduleCode}</p>
                  <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5">{item.module.title}</p>
                </div>
                <Badge variant={moduleBadgeVariant(item.status)}>
                  {moduleStatusLabel(item.status)}
                </Badge>
              </div>
              <div className="text-[11px] text-text-secondary">
                {item.module.requirementRole === 'prerequisite_cert' ? (
                  <span className="font-semibold text-amber-700 block">Certificate Prerequisite</span>
                ) : item.module.requirementRole === 'transition_core' ? (
                  <span className="font-semibold text-primary block">Diploma Transition Core</span>
                ) : null}
                {item.status === 'resit' && item.resitPaperCodes.length > 0 ? (
                  <span className="font-semibold text-amber-800">
                    Resit papers: {item.resitPaperCodes.join(', ')}
                  </span>
                ) : item.activeSeriesName ? (
                  <span>Booked for {item.activeSeriesName}</span>
                ) : item.completedSeriesName ? (
                  <span>Passed in {item.completedSeriesName}</span>
                ) : (
                  <span>{item.module.papers.length} examination papers</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {missingProfileFields.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50/90 p-4 shadow-2xs print:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-amber-950">
                  Student Profile Biodata Required for Module I KNEC Registration
                </h2>
                <p className="text-xs text-amber-900">
                  Before applying for <strong>Module I</strong>, please complete your profile:{' '}
                  <strong>{missingProfileFields.join(', ')}</strong>. These confidential details are
                  kept strictly in your Student Profile for KNEC portal registration and are{' '}
                  <strong>never printed</strong> on your KNEC clearance form.
                </p>
              </div>
            </div>
            <Link
              href="/student/profile"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-amber-900 px-3.5 text-xs font-bold text-white transition hover:bg-amber-950"
            >
              Update Student Profile
            </Link>
          </div>
        </Card>
      ) : null}

      {/* Main Layout: Left Booking Form, Right History + Clearance PDF */}
      <div className="xl:grid xl:grid-cols-12 xl:gap-6 space-y-6 xl:space-y-0">
        {/* Booking Form */}
        <div className="xl:col-span-5 print:hidden">
          <Card className="p-4 sm:p-5 border-border shadow-2xs">
            <h2 id={formHeadingId} className="text-sm font-bold text-text-primary flex items-center gap-2">
              <ClipboardList className="size-4 text-primary" aria-hidden="true" />
              <span>Book KNEC Examination Series</span>
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Select an open KNEC series and choose the module(s) or resit papers you are ready to sit.
            </p>

            {openSeries.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={ClipboardList}
                  title="No KNEC series open for booking"
                  description="Contact your HOD when the next KNEC examination booking window opens."
                />
              </div>
            ) : bookableModules.length === 0 ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold">All required KNEC modules completed</p>
                  <p className="mt-0.5 text-emerald-800">
                    You have completed all required modules for {summary.programmeName}.
                  </p>
                </div>
              </div>
            ) : (
              <form
                action={formAction}
                aria-labelledby={formHeadingId}
                className="mt-4 space-y-4"
              >
                <div className="space-y-1">
                  <label htmlFor={seriesSelectId} className="block text-xs font-bold text-text-primary">
                    KNEC Exam Series <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id={seriesSelectId}
                    name="seriesId"
                    required
                    value={selectedSeriesId}
                    onChange={(e) => setSelectedSeriesId(e.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {openSeries.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.seriesName} ({s.seriesCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-border bg-surface-subtle/60 px-3 py-2.5 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    KNEC Index Number
                  </p>
                  <p className="text-sm font-mono font-bold text-text-primary">
                    {summary.knecIndexNumber ?? 'Pending — issued after KNEC portal registration'}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    KNEC index numbers are generated on the KNEC portal after registration closes and updated by your Registrar/HOD.
                  </p>
                </div>

                <fieldset className="space-y-3 rounded-xl border border-border p-3 bg-surface-subtle/40">
                  <legend className="px-1.5 text-xs font-bold text-text-primary">
                    Select Modules &amp; Papers to Sit <span aria-hidden="true">*</span>
                  </legend>

                  {bookableModules.map((modItem) => {
                    const modPaperCodes = modItem.module.papers.map((p) => p.paperCode);
                    const allSelected =
                      modPaperCodes.length > 0 && modPaperCodes.every((c) => selectedPapers.includes(c));
                    return (
                      <div
                        key={modItem.module.id}
                        className="rounded-lg border border-border bg-white p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft pb-2">
                          <div>
                            <p className="text-xs font-extrabold text-text-primary">
                              {modItem.module.moduleCode} · {modItem.module.title}
                            </p>
                            <p className="text-[11px] text-text-muted">
                              Status: {moduleStatusLabel(modItem.status)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => selectWholeModule(modPaperCodes)}
                            className="inline-flex h-8 items-center rounded-md border border-border bg-surface-subtle px-2.5 text-[11px] font-bold text-text-primary hover:bg-primary-soft hover:text-primary"
                          >
                            {allSelected ? 'Clear Module' : 'Select All Papers'}
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {modItem.module.papers.map((paper) => {
                            const checkboxId = `paper-${paper.paperCode.replace(/[^a-zA-Z0-9]/g, '-')}`;
                            const isChecked = selectedPapers.includes(paper.paperCode);
                            const isSuggestedResit = modItem.resitPaperCodes.includes(paper.paperCode);
                            return (
                              <div key={paper.id} className="flex items-start gap-2.5 py-0.5">
                                <input
                                  id={checkboxId}
                                  type="checkbox"
                                  name="paperCodes"
                                  value={paper.paperCode}
                                  checked={isChecked}
                                  onChange={() => togglePaper(paper.paperCode)}
                                  className="mt-0.5 size-4 shrink-0 rounded border-slate-400 accent-[#0b4f4a]"
                                />
                                <label
                                  htmlFor={checkboxId}
                                  className="text-xs text-text-primary leading-snug cursor-pointer flex-1"
                                >
                                  <span className="font-mono font-bold">{paper.paperCode}</span>{' '}
                                  <span>{paper.paperName}</span>
                                  {isSuggestedResit ? (
                                    <span className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-900">
                                      Resit
                                    </span>
                                  ) : null}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </fieldset>

                <div className="space-y-1">
                  <label htmlFor={notesInputId} className="block text-xs font-bold text-text-primary">
                    Remarks (Optional)
                  </label>
                  <input
                    id={notesInputId}
                    name="notes"
                    type="text"
                    placeholder="e.g. Sitting Module II + resit paper"
                    maxLength={300}
                    className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div aria-live="polite">
                  {state.status !== 'idle' && state.message ? (
                    <div
                      className={`rounded-lg border px-3 py-2.5 text-xs font-semibold ${
                        state.status === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border-rose-200 bg-rose-50 text-rose-900'
                      }`}
                    >
                      {state.message}
                    </div>
                  ) : null}
                </div>

                {isLockedSeriesBooking ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Your booking for {activeSelectedSeries?.seriesName} is already{' '}
                    <strong>{existingOpenBooking?.bookingStatus.replace('_', ' ')}</strong> and locked from edits.
                  </p>
                ) : isBlockedByMissingProfile ? (
                  <div className="space-y-2">
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
                      Module I booking requires completing your Student Profile first (missing:{' '}
                      {missingProfileFields.join(', ')}).
                    </p>
                    <Link
                      href="/student/profile"
                      className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-xs font-bold text-white transition hover:bg-primary/90"
                    >
                      Complete Student Profile to Book Module I
                    </Link>
                  </div>
                ) : (
                  <Button type="submit" disabled={isPending} className="w-full h-11 font-bold">
                    {isPending ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
                        <span>Submitting Booking...</span>
                      </>
                    ) : existingOpenBooking ? (
                      'Update KNEC Booking & Clearance Form'
                    ) : (
                      'Submit KNEC Booking & Generate Clearance Form'
                    )}
                  </Button>
                )}
              </form>
            )}
          </Card>
        </div>

        {/* Right Column: Past & Active Series Bookings + Printable Clearance Form */}
        <div className="xl:col-span-7 space-y-5">
          <Card className="p-4 sm:p-5 border-border shadow-2xs print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
                  <span>KNEC Exam Series &amp; Papers Done</span>
                </h2>
                <p className="text-xs text-text-muted">
                  Download your KNEC Clearance PDF to complete signoff with HOD, Accounts, Registrar, Principal, and Managing Director.
                </p>
              </div>
            </div>

            {summary.bookings.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title="No KNEC series bookings yet"
                description="Submit a booking on the left when you are ready to sit an exam series."
              />
            ) : (
              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Series</TableHead>
                      <TableHead>Index No.</TableHead>
                      <TableHead>Papers</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-bold text-text-primary">{booking.seriesName}</TableCell>
                        <TableCell className="font-mono text-text-secondary">
                          {booking.knecIndexNumber ?? summary.knecIndexNumber ?? '—'}
                        </TableCell>
                        <TableCell>
                          {Array.from(new Set(booking.papers.map((p) => p.moduleCode))).join(', ')} ({booking.papers.length})
                        </TableCell>
                        <TableCell className="uppercase">{booking.bookingType}</TableCell>
                        <TableCell>
                          <Badge variant={bookingStatusBadge(booking.bookingStatus)}>
                            {bookingStatusLabel(booking.bookingStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewBookingId(booking.id)}
                              className="inline-flex h-8 items-center rounded-md border border-border bg-white px-2.5 text-xs font-semibold text-text-primary hover:bg-surface-subtle"
                            >
                              Preview
                            </button>
                            <a
                              href={`/api/student/knec/form?bookingId=${encodeURIComponent(booking.id)}`}
                              className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-white hover:bg-primary/90"
                            >
                              <Download className="size-3.5" aria-hidden="true" />
                              <span>PDF</span>
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>

          {/* Printable Clearance Preview */}
          {activePreviewContext ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Clearance Form Preview ({activePreviewContext.booking.seriesName})
                </h3>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/student/knec/form?bookingId=${encodeURIComponent(activePreviewContext.booking.id)}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-xs hover:bg-primary/90"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    <span>Download Official Clearance PDF</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-primary hover:bg-surface-subtle"
                  >
                    <Printer className="size-3.5" aria-hidden="true" />
                    <span>Print</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-slate-100 p-3 print:border-0 print:bg-white print:p-0">
                <KnecBookingFormPreview context={activePreviewContext} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
