'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type {
  BulkMarksValidationSummary,
  MatchedBulkStudentResult,
} from './bulk-upload-parser';

interface BulkUploadDialogProps {
  assessmentId: string;
  unitName?: string;
  mode?: 'staff' | 'admin';
  trigger?: React.ReactNode;
  onAppliedToEditor?: (matched: MatchedBulkStudentResult[]) => void;
  onSaveSuccess?: () => void;
}

export function BulkUploadDialog({
  assessmentId,
  unitName = 'Unit Marksheet',
  mode = 'staff',
  trigger,
  onAppliedToEditor,
  onSaveSuccess,
}: BulkUploadDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<BulkMarksValidationSummary | null>(null);
  const [busy, setBusy] = useState<'parsing' | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetState = () => {
    setFile(null);
    setSummary(null);
    setBusy(null);
    setError(null);
    setSuccessMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  };

  const uploadEndpoint =
    mode === 'staff'
      ? `/api/staff/assessment/${assessmentId}/online/bulk-upload`
      : `/api/assessment/markbooks/${assessmentId}/bulk-upload`;

  const downloadEndpoint =
    mode === 'staff'
      ? `/api/staff/assessment/${assessmentId}/markbook`
      : `/api/assessment/markbooks/${assessmentId}/download`;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setSuccessMessage(null);
    setBusy('parsing');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('action', 'preview');

      const res = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to parse spreadsheet.');
      }

      setSummary(data.summary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse spreadsheet file.';
      setError(msg);
      setSummary(null);
    } finally {
      setBusy(null);
    }
  };

  const handleApplyToEditor = () => {
    if (!summary || !onAppliedToEditor) return;
    onAppliedToEditor(summary.matched);
    setOpen(false);
    resetState();
  };

  const handleCommitDirectly = async () => {
    if (!file) return;

    setBusy('saving');
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'commit');

      const res = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to save marks from spreadsheet.');
      }

      setSuccessMessage(`Successfully saved marks for ${data.savedCount} candidate(s)!`);
      if (onSaveSuccess) onSaveSuccess();
      router.refresh();

      setTimeout(() => {
        setOpen(false);
        resetState();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save marks.';
      setError(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} credentials-testid="bulk-upload-dialog" onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <Upload className="size-3.5 text-slate-500" />
            <span>Bulk Upload Marks</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <FileSpreadsheet className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Bulk Upload Marks
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {unitName} · Upload an Excel (.xlsx) or CSV spreadsheet to populate marks.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          {/* Information & Template Tip */}
          <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs text-slate-600">
            <div className="space-y-1">
              <p className="font-semibold text-slate-800">Expected Format</p>
              <p className="text-[11px] leading-relaxed text-slate-500">
                The spreadsheet must have an <strong>Admission Number</strong> column. It can include marks for{' '}
                <strong>Assignment (/5)</strong>, <strong>Presentation (/10)</strong>, <strong>RAT (/15)</strong>,{' '}
                <strong>CAT (/15)</strong>, and <strong>Exam (/70)</strong>. Absent students can be marked as{' '}
                <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">AB</code> or{' '}
                <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">Absent</code>.
              </p>
            </div>
            <a
              href={downloadEndpoint}
              download
              className="ml-3 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <Download className="size-3 text-slate-400" />
              <span>Download Blank Template</span>
            </a>
          </div>

          {/* File Picker Area */}
          {!summary ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center transition hover:border-emerald-400 hover:bg-emerald-50/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <span className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-emerald-100 group-hover:text-emerald-700">
                {busy === 'parsing' ? (
                  <LoaderCircle className="size-6 animate-spin text-emerald-600" />
                ) : (
                  <Upload className="size-6" />
                )}
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {busy === 'parsing' ? 'Reading and matching spreadsheet...' : 'Choose a spreadsheet file to upload'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Drag and drop or click to browse (supports .xlsx, .xls, .csv)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File details bar */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <FileSpreadsheet className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{file?.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {Math.round((file?.size ?? 0) / 1024)} KB · {summary.totalRowsRead} rows processed
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  className="h-7 text-xs text-slate-500 hover:text-slate-800"
                >
                  <X className="mr-1 size-3.5" />
                  <span>Choose Different File</span>
                </Button>
              </div>

              {/* Parsing Telemetry */}
              <div className="grid grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Matched Students
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-900">
                    {summary.matchedCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Unmatched Rows
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-700">
                    {summary.unmatchedCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Missing from File
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-700">
                    {summary.missingCount}
                  </p>
                </div>
                <div
                  className={`rounded-xl border p-3 ${
                    summary.errorCount > 0
                      ? 'border-red-200 bg-red-50/60 text-red-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      summary.errorCount > 0 ? 'text-red-700' : 'text-slate-500'
                    }`}
                  >
                    Errors
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {summary.errorCount}
                  </p>
                </div>
              </div>

              {/* Error messages if any */}
              {summary.errors.length > 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-800">
                    <AlertCircle className="size-4 text-red-600" />
                    <span>Spreadsheet Validation Errors ({summary.errors.length})</span>
                  </div>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-red-700">
                    {summary.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {summary.errors.length > 5 ? (
                      <li className="font-semibold text-red-800">
                        ...and {summary.errors.length - 5} more error(s)
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {/* Unmatched / Missing warnings */}
              {summary.unmatched.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="size-4 text-amber-600" />
                    <span>Unmatched Admission Numbers ({summary.unmatched.length})</span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700">
                    The following rows were in the spreadsheet but did not match registered students in this unit:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {summary.unmatched.map((u, i) => (
                      <Badge
                        key={i}
                        variant="neutral"
                        className="border-amber-300 bg-amber-100 text-[10px] text-amber-900"
                      >
                        {u.admissionNumber} {u.fullName ? `(${u.fullName})` : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Matched Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Matched Students Preview ({summary.matchedCount})
                  </p>
                </div>
                <div className="max-h-60 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-center">No.</th>
                        <th className="px-3 py-2">Admission No.</th>
                        <th className="px-3 py-2">Student Name</th>
                        <th className="px-2.5 py-2 text-center">Assig /5</th>
                        <th className="px-2.5 py-2 text-center">Pres /10</th>
                        <th className="px-2.5 py-2 text-center">RAT /15</th>
                        <th className="px-2.5 py-2 text-center">CAT /15</th>
                        <th className="px-2.5 py-2 text-center">Exam /70</th>
                        <th className="px-2.5 py-2 text-center">Total /100</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {summary.matched.map((row, idx) => (
                        <tr key={row.studentId} className="hover:bg-slate-50/50">
                          <td className="px-3 py-1.5 text-center font-sans text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-1.5 font-sans font-semibold text-slate-900">
                            {row.admissionNumber}
                          </td>
                          <td className="px-3 py-1.5 font-sans text-slate-800">
                            {row.fullName}
                          </td>
                          <td className="px-2.5 py-1.5 text-center text-slate-700">
                            {row.assignment ?? '—'}
                          </td>
                          <td className="px-2.5 py-1.5 text-center text-slate-700">
                            {row.presentation ?? '—'}
                          </td>
                          <td className="px-2.5 py-1.5 text-center text-slate-700">
                            {row.rat ?? '—'}
                          </td>
                          <td className="px-2.5 py-1.5 text-center text-slate-700">
                            {row.cat ?? '—'}
                          </td>
                          <td className="px-2.5 py-1.5 text-center">
                            {row.attendanceStatus === 'absent' ? (
                              <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-sans font-bold text-slate-700">
                                AB
                              </span>
                            ) : (
                              row.exam ?? '—'
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 text-center font-bold text-slate-900">
                            {row.finalTotal ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="size-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-slate-100 bg-slate-50/70 px-6 py-3.5 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-xs text-slate-600"
          >
            Cancel
          </Button>

          {summary ? (
            <div className="flex items-center gap-2">
              {mode === 'staff' && onAppliedToEditor ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleApplyToEditor}
                  disabled={summary.matchedCount === 0}
                  className="h-8 gap-1.5 bg-emerald-600 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Apply to Online Editor ({summary.matchedCount})</span>
                </Button>
              ) : null}

              <Button
                type="button"
                variant={mode === 'staff' && onAppliedToEditor ? 'outline' : 'primary'}
                size="sm"
                onClick={handleCommitDirectly}
                disabled={summary.matchedCount === 0 || summary.errorCount > 0 || busy === 'saving'}
                className="h-8 gap-1.5 text-xs font-semibold shadow-2xs"
              >
                {busy === 'saving' ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                <span>
                  {mode === 'staff' && onAppliedToEditor
                    ? 'Save Draft Directly'
                    : `Save & Import Marks (${summary.matchedCount})`}
                </span>
              </Button>
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
