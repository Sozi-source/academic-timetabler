'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileSpreadsheet,
  Archive,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  parseBulkCourseOutlinesAction,
  commitBulkCourseOutlinesAction,
} from './bulk-curriculum-actions';
import type { BulkCourseOutlineUnit, BulkParseResult } from './bulk-curriculum-parser';

export function BulkCourseOutlineUploadDialog() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isParsing, startParsingTransition] = useTransition();
  const [isCommitting, startCommitTransition] = useTransition();

  const [parseResult, setParseResult] = useState<BulkParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const hasValidationErrors = parseResult?.issues.some((issue) => issue.severity === 'error') ?? false;

  const handleOpen = () => {
    setIsOpen(true);
    setParseResult(null);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleClose = () => {
    setIsOpen(false);
    setParseResult(null);
    setErrorMessage('');
    setSuccessMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setSuccessMessage('');
    setParseResult(null);

    const formData = new FormData();
    formData.append('file', file);

    startParsingTransition(async () => {
      try {
        const result = await parseBulkCourseOutlinesAction(formData);
        if (!result.ok) {
          setErrorMessage(result.error || 'Failed to parse file.');
        } else {
          setParseResult(result);
          if (result.units.length === 0) {
            setErrorMessage('No course outlines or units could be extracted from this file.');
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unexpected error during upload';
        setErrorMessage(msg);
      }
    });
  };

  const handleCommit = () => {
    if (!parseResult || parseResult.units.length === 0) return;

    startCommitTransition(async () => {
      try {
        const res = await commitBulkCourseOutlinesAction(
          parseResult.units,
          parseResult.fileName,
        );

        if (res.success) {
          setSuccessMessage(res.message);
          setParseResult(null);
          router.refresh();
          setTimeout(() => {
            handleClose();
          }, 1800);
        } else {
          setErrorMessage(res.error || res.message || 'Failed to commit outlines.');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Commit failed';
        setErrorMessage(msg);
      }
    });
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={handleOpen}
        leadingIcon={<UploadCloud className="size-3.5" />}
      >
        Bulk Upload Outlines
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-subtle">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">
                    Authoritative Bulk Course Outline Upload
                  </h2>
                  <p className="text-xs text-text-muted">
                    Upload official syllabus content in bulk. The system retains 100% of the current TVET 14-week layout.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isParsing || isCommitting}
                className="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary transition"
                aria-label="Close dialog"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Instructions and Download Template Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <FileSpreadsheet className="size-4" />
                    Download Pre-filled Department Excel Template
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Downloads an Excel workbook pre-populated with all active units in your department, ready for syllabus topic entry.
                  </p>
                </div>
                <a
                  href="/api/curriculum/template"
                  download="Authoritative_Course_Outline_Upload_Template.xlsx"
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3.5 py-2 text-xs font-bold text-primary shadow-xs hover:bg-primary/10 transition"
                >
                  <Download className="size-3.5" />
                  Download Template (.xlsx)
                </a>
              </div>

              {/* Upload Drop Area */}
              <div className="rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition bg-surface/50">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .zip"
                  onChange={handleFileChange}
                  disabled={isParsing || isCommitting}
                  className="hidden"
                  id="bulk-outline-file-input"
                />
                <label
                  htmlFor="bulk-outline-file-input"
                  className="flex flex-col items-center justify-center cursor-pointer space-y-2.5"
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-surface border border-border shadow-xs text-primary">
                    {isParsing ? (
                      <Loader2 className="size-6 animate-spin" />
                    ) : (
                      <UploadCloud className="size-6" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-primary hover:underline">
                      Click to choose file
                    </span>
                    <span className="text-xs text-text-muted"> or drag and drop here</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <FileSpreadsheet className="size-3 text-emerald-600" />
                      Excel Workbook (.xlsx)
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Archive className="size-3 text-indigo-600" />
                      Word Syllabus ZIP (.zip)
                    </span>
                  </div>
                </label>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-danger flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Upload Error: </span>
                    {errorMessage}
                  </div>
                </div>
              )}

              {/* Success Alert */}
              {successMessage && (
                <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-success flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  <div className="font-bold">{successMessage}</div>
                </div>
              )}

              {/* Preview Section */}
              {parseResult && parseResult.units.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Extracted Units Preview ({parseResult.totalUnits} Units Found)
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">
                        {parseResult.matchedCount} Matched
                      </Badge>
                      {parseResult.unmatchedCount > 0 && (
                        <Badge variant="warning">
                          {parseResult.unmatchedCount} Unmatched
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {parseResult.units.map((unit, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 text-xs hover:bg-surface-subtle transition"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-text-primary">
                              {unit.unitCode}
                            </span>
                            <span className="text-text-muted truncate">
                              {unit.unitName}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-text-muted">
                            <span className="inline-flex items-center gap-1">
                              <FileText className="size-3 text-text-tertiary" />
                              {unit.topics.length} Syllabus Topic{unit.topics.length === 1 ? '' : 's'}
                            </span>
                            {unit.unitDescription && (
                              <span className="truncate max-w-xs text-text-tertiary">
                                • {unit.unitDescription}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          {unit.status === 'matched' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="size-3" />
                              Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                              New Unit
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {parseResult.issues.length > 0 && (
                    <div className="rounded-xl border border-border bg-surface p-3 space-y-1">
                      <p className="text-[11px] font-bold text-text-secondary">Validation Notes:</p>
                      <ul className="text-[10px] text-text-muted space-y-0.5 list-disc pl-4">
                        {parseResult.issues.slice(0, 5).map((iss, i) => (
                          <li key={i}>{iss.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border px-6 py-3.5 bg-surface-subtle">
              <span className="text-[11px] text-text-muted">
                {hasValidationErrors
                  ? 'Resolve the topic and coverage issues before publishing'
                  : parseResult
                    ? `${parseResult.units.length} unit(s) ready to publish`
                    : 'Select a file to begin'}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={isParsing || isCommitting}
                >
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCommit}
                  disabled={!parseResult || parseResult.units.length === 0 || hasValidationErrors || isCommitting || isParsing}
                  leadingIcon={
                    isCommitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )
                  }
                >
                  {isCommitting ? 'Publishing Outlines...' : 'Commit Authoritative Outlines'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
