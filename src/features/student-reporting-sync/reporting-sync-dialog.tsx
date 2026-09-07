'use client';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CloudDownload,
  FileSpreadsheet,
  Link as LinkIcon,
  LoaderCircle,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import { useId, useMemo, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { commitReportingSyncAction, previewReportingSyncAction } from './actions';
import type {
  ReconciledReportingItem,
  ReportingMatchState,
  ReportingSyncPreviewResult,
  ReportingSyncSourceType,
} from './types';

interface ReportingSyncDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function ReportingSyncDialog({ trigger, onSuccess }: ReportingSyncDialogProps) {
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<ReportingSyncSourceType>('google_sheet');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [step, setStep] = useState<'input' | 'preview' | 'success'>('input');
  const [previewData, setPreviewData] = useState<ReportingSyncPreviewResult | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [filterState, setFilterState] = useState<'all' | ReportingMatchState>('ready');
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [searchQuery, setSearchQuery] = useState('');

  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputId = useId();

  const handleReset = () => {
    setStep('input');
    setPreviewData(null);
    setSelectedStudentIds(new Set());
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleFetchPreview = () => {
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('sourceType', sourceType);

    if (sourceType === 'google_sheet') {
      if (!googleSheetUrl.trim()) {
        setErrorMessage('Please enter a Google Sheets URL.');
        return;
      }
      formData.append('googleSheetUrl', googleSheetUrl.trim());
    } else if (sourceType === 'file') {
      if (!selectedFile) {
        setErrorMessage('Please select a spreadsheet file (.xlsx or .csv).');
        return;
      }
      formData.append('file', selectedFile);
    } else if (sourceType === 'paste') {
      if (!pastedText.trim()) {
        setErrorMessage('Please paste at least one admission number.');
        return;
      }
      formData.append('pastedText', pastedText.trim());
    }

    startTransition(async () => {
      const result = await previewReportingSyncAction(formData);
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to process spreadsheet.');
        return;
      }

      setPreviewData(result);
      // Pre-select all students in 'ready' state
      const readyIds = new Set<string>();
      for (const item of result.items) {
        if (item.matchState === 'ready' && item.studentId) {
          readyIds.add(item.studentId);
        }
      }
      setSelectedStudentIds(readyIds);
      setStep('preview');
    });
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleToggleSelectAllReady = (readyItems: ReconciledReportingItem[]) => {
    const allReadySelected = readyItems.every((item) =>
      item.studentId ? selectedStudentIds.has(item.studentId) : false,
    );

    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      for (const item of readyItems) {
        if (!item.studentId) continue;
        if (allReadySelected) {
          next.delete(item.studentId);
        } else {
          next.add(item.studentId);
        }
      }
      return next;
    });
  };

  const handleCommit = () => {
    if (selectedStudentIds.size === 0) {
      setErrorMessage('Please select at least one student to confirm.');
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      const ids = Array.from(selectedStudentIds);
      const result = await commitReportingSyncAction(ids, effectiveDate);

      if (!result.success) {
        setErrorMessage(result.message || 'Failed to confirm reporting.');
        return;
      }

      setSuccessMessage(result.message);
      setStep('success');
      onSuccess?.();
    });
  };

  // Filtered items in preview view
  const filteredItems = useMemo(() => {
    if (!previewData) return [];
    return previewData.items.filter((item) => {
      if (filterState !== 'all' && item.matchState !== filterState) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesAdm = item.admissionNumber.toLowerCase().includes(query);
        const matchesName = item.studentName?.toLowerCase().includes(query) ?? false;
        const matchesCohort = item.cohortName?.toLowerCase().includes(query) ?? false;
        if (!matchesAdm && !matchesName && !matchesCohort) return false;
      }
      return true;
    });
  }, [previewData, filterState, searchQuery]);

  const readyItems = useMemo(() => {
    return previewData?.items.filter((i) => i.matchState === 'ready' && i.studentId) ?? [];
  }, [previewData]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) handleReset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5 shadow-2xs">
            <CloudDownload className="size-3.5 text-primary" />
            <span>Sync Reporting</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-surface-subtle p-5">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CloudDownload className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-text-primary">
                    Sync Registrar Reporting Records
                  </DialogTitle>
                  <DialogDescription className="text-xs text-text-muted">
                    Reconcile reported students in real-time from Google Sheets, Excel, or clipboard paste.
                  </DialogDescription>
                </div>
              </div>
              {previewData?.academicPeriod ? (
                <Badge variant="institutional">{previewData.academicPeriod.name}</Badge>
              ) : null}
            </div>
          </DialogHeader>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {errorMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger-subtle p-3 text-xs text-danger">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to process</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* STEP 1: INPUT SOURCE FORM */}
          {step === 'input' && (
            <div className="space-y-4">
              {/* Source Tabs */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface-subtle p-1">
                <button
                  type="button"
                  onClick={() => setSourceType('google_sheet')}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                    sourceType === 'google_sheet'
                      ? 'bg-surface text-primary shadow-2xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <LinkIcon className="size-3.5" />
                  Live Google Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('file')}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                    sourceType === 'file'
                      ? 'bg-surface text-primary shadow-2xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <FileSpreadsheet className="size-3.5" />
                  Excel / CSV File
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('paste')}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                    sourceType === 'paste'
                      ? 'bg-surface text-primary shadow-2xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Upload className="size-3.5" />
                  Quick Paste
                </button>
              </div>

              {/* Live Google Sheet Input */}
              {sourceType === 'google_sheet' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary">
                      Registrar Google Sheets Link
                    </label>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      Paste the link to the Registrar’s reporting spreadsheet (e.g. from Google Sheets address bar).
                    </p>
                    <Input
                      type="url"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="mt-1.5 h-9 font-mono text-xs"
                    />
                  </div>

                  <div className="rounded-lg border border-primary/20 bg-primary-subtle/30 p-3 text-[11px] text-text-secondary">
                    <p className="font-semibold text-primary">Sharing Requirement:</p>
                    <p className="mt-0.5">
                      Ensure the Google Sheet is shared with <strong>&ldquo;Anyone with the link can view&rdquo;</strong> (or published to web) so the system can fetch live daily updates.
                    </p>
                  </div>
                </div>
              )}

              {/* File Upload Input */}
              {sourceType === 'file' && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-text-primary">
                    Upload Spreadsheet File (.xlsx or .csv)
                  </label>
                  <div
                    onClick={() => document.getElementById(fileInputId)?.click()}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-subtle p-6 text-center hover:border-primary/50 cursor-pointer transition"
                  >
                    <FileSpreadsheet className="size-8 text-primary" />
                    <p className="mt-2 text-xs font-bold text-text-primary">
                      {selectedFile ? selectedFile.name : 'Click to select Excel or CSV file'}
                    </p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                        : 'Supports .xlsx, .xls, and .csv with an Admission Number column'}
                    </p>
                    <input
                      id={fileInputId}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                      }}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* Quick Paste Input */}
              {sourceType === 'paste' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary">
                      Paste Admission Numbers or Rows
                    </label>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      Copy rows from any spreadsheet and paste here.
                    </p>
                    <textarea
                      rows={6}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder={'CHN/S-4184/IC/24\nCHN/S-4680/IC/24\nDNDT/2026/001'}
                      className="mt-1.5 w-full rounded-lg border border-border bg-surface p-3 font-mono text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PREVIEW & RECONCILIATION */}
          {step === 'preview' && previewData && (
            <div className="space-y-4">
              {/* Metric Summary Cards */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg border border-border bg-surface p-2.5">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Total Rows</p>
                  <p className="mt-1 text-lg font-extrabold text-text-primary">{previewData.summary.totalRows}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Ready to Activate
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                    {previewData.summary.readyCount}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 dark:border-blue-900/50 dark:bg-blue-950/20">
                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Already Active
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-blue-700 dark:text-blue-400">
                    {previewData.summary.alreadyReportedCount}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Unmatched
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-amber-700 dark:text-amber-400">
                    {previewData.summary.unmatchedCount}
                  </p>
                </div>
              </div>

              {/* Filter Pills & Search */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFilterState('ready')}
                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                      filterState === 'ready'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-surface-subtle text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Ready ({previewData.summary.readyCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterState('already_reported')}
                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                      filterState === 'already_reported'
                        ? 'bg-blue-600 text-white'
                        : 'bg-surface-subtle text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Already Active ({previewData.summary.alreadyReportedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterState('unmatched')}
                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                      filterState === 'unmatched'
                        ? 'bg-amber-600 text-white'
                        : 'bg-surface-subtle text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Unmatched ({previewData.summary.unmatchedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterState('all')}
                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                      filterState === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-surface-subtle text-text-muted hover:text-text-primary'
                    }`}
                  >
                    All ({previewData.summary.totalRows})
                  </button>
                </div>

                <div className="relative min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search preview..."
                    className="h-7 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Student Table */}
              <div className="max-h-[300px] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-surface-subtle text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        {filterState === 'ready' && readyItems.length > 0 && (
                          <input
                            type="checkbox"
                            checked={readyItems.every((item) =>
                              item.studentId ? selectedStudentIds.has(item.studentId) : false,
                            )}
                            onChange={() => handleToggleSelectAllReady(readyItems)}
                            className="size-3.5 rounded border-border text-primary cursor-pointer"
                          />
                        )}
                      </th>
                      <th className="px-3 py-2">Admission No</th>
                      <th className="px-3 py-2">Student Name</th>
                      <th className="px-3 py-2">Cohort</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-text-muted">
                          No items in this category.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {
                        const isSelectable = item.matchState === 'ready' && item.studentId;
                        const isChecked = item.studentId ? selectedStudentIds.has(item.studentId) : false;

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-surface-subtle/50 transition ${
                              isChecked ? 'bg-primary-subtle/20' : ''
                            }`}
                          >
                            <td className="px-3 py-2">
                              {isSelectable ? (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => item.studentId && handleToggleStudent(item.studentId)}
                                  className="size-3.5 rounded border-border text-primary cursor-pointer"
                                />
                              ) : null}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-text-primary">
                              {item.admissionNumber}
                            </td>
                            <td className="px-3 py-2 font-medium text-text-primary">
                              {item.studentName ?? (
                                <span className="italic text-text-muted">Not recognized</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-text-muted">{item.cohortName ?? '-'}</td>
                            <td className="px-3 py-2 text-right">
                              {item.matchState === 'ready' && (
                                <Badge variant="success" className="text-[10px]">
                                  Ready to Activate
                                </Badge>
                              )}
                              {item.matchState === 'already_reported' && (
                                <Badge variant="institutional" className="text-[10px]">
                                  Already Active
                                </Badge>
                              )}
                              {item.matchState === 'unmatched' && (
                                <Badge variant="warning" className="text-[10px]">
                                  Unmatched
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Effective Date & Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-text-muted">Reporting Date:</label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="h-8 w-36 text-xs"
                  />
                </div>
                <div className="text-xs text-text-muted">
                  <span className="font-bold text-emerald-600">{selectedStudentIds.size}</span> student
                  {selectedStudentIds.size === 1 ? '' : 's'} selected for activation
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS VIEW */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <CheckCircle2 className="size-8" />
              </div>
              <h3 className="mt-3 text-base font-bold text-text-primary">
                Reporting Reconciliation Complete
              </h3>
              <p className="mt-1 text-xs text-text-muted max-w-sm">
                {successMessage || 'Students have been activated and marked reported for the active semester.'}
              </p>
              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleReset();
                  }}
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Sync Another Sheet
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    handleReset();
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step !== 'success' && (
          <div className="flex items-center justify-between border-t border-border bg-surface-subtle px-5 py-3">
            {step === 'preview' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep('input')}
                disabled={isPending}
                className="gap-1.5"
              >
                <ArrowLeft className="size-3.5" />
                Change Source
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            )}

            {step === 'input' && (
              <Button
                type="button"
                size="sm"
                onClick={handleFetchPreview}
                disabled={isPending}
                className="gap-1.5"
              >
                {isPending ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Reconciling...
                  </>
                ) : (
                  <>
                    <Search className="size-3.5" />
                    Fetch &amp; Reconcile
                  </>
                )}
              </Button>
            )}

            {step === 'preview' && (
              <Button
                type="button"
                size="sm"
                onClick={handleCommit}
                disabled={isPending || selectedStudentIds.size === 0}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Confirm &amp; Activate ({selectedStudentIds.size})
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
