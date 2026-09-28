'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  ArrowLeft,
  FileUp,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  parseBulkCourseOutlinesAction,
  commitBulkCourseOutlinesAction,
} from './bulk-curriculum-actions';
import type { BulkParseResult } from './bulk-curriculum-parser';

export function BulkUploadView() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isParsing, startParsingTransition] = useTransition();
  const [isCommitting, startCommitTransition] = useTransition();

  const [parseResult, setParseResult] = useState<BulkParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const hasValidationErrors =
    parseResult?.issues.some((issue) => issue.severity === 'error') ?? false;

  const handleReset = () => {
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
            setErrorMessage(
              'No course outlines or schemes of work could be extracted from this file.'
            );
          }
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Unexpected error during upload';
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
          parseResult.fileName
        );

        if (res.success) {
          setSuccessMessage(res.message);
          setParseResult(null);
          router.refresh();
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        eyebrow="Curriculum Management"
        title="Bulk Curriculum Upload"
        description="Batch upload Course Outlines and Schemes of Work via Excel (.xlsx) or Word ZIP archives (.zip)."
        icon={UploadCloud}
        backHref="/teaching-documents/curriculum"
        backLabel="Back to Curriculum"
        actions={
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/teaching-documents/curriculum/individual-upload"
              className="inline-flex h-9 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 text-xs font-semibold text-text-primary shadow-2xs hover:bg-surface-subtle transition"
            >
              <FileUp className="size-3.5 text-primary" />
              Individual Upload
            </Link>
          </div>
        }
      />

      {/* Instructions & Template Download Card */}
      <Card className="p-5 border-primary/20 bg-primary/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-bold text-primary flex items-center gap-2">
              <FileSpreadsheet className="size-4" />
              Standard Curriculum Excel Template
            </div>
            <p className="text-xs text-text-secondary leading-relaxed max-w-2xl">
              Use our standardized Excel workbook template pre-filled with department units. Each unit can specify both Course Outline and Scheme of Work topics. Alternatively, upload a ZIP archive containing individual Word (.docx) outlines.
            </p>
          </div>
          <a
            href="/api/curriculum/template"
            download="Authoritative_Course_Outline_Upload_Template.xlsx"
            className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2 text-xs font-bold text-primary shadow-xs hover:bg-primary/10 transition"
          >
            <Download className="size-4" />
            Download Excel Template (.xlsx)
          </a>
        </div>
      </Card>

      {/* Main Upload Dropzone */}
      <Card className="p-8 border-2 border-dashed border-border hover:border-primary/50 transition bg-surface/50 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .zip"
          onChange={handleFileChange}
          disabled={isParsing || isCommitting}
          className="hidden"
          id="bulk-upload-page-file-input"
        />
        <label
          htmlFor="bulk-upload-page-file-input"
          className="flex flex-col items-center justify-center cursor-pointer space-y-3"
        >
          <div className="flex size-16 items-center justify-center rounded-2xl bg-white border border-border shadow-xs text-primary">
            {isParsing ? (
              <Loader2 className="size-8 animate-spin" />
            ) : (
              <UploadCloud className="size-8" />
            )}
          </div>
          <div>
            <span className="text-sm font-bold text-primary hover:underline">
              Choose an Excel workbook (.xlsx) or ZIP archive (.zip)
            </span>
            <span className="text-sm text-text-muted"> to upload in bulk</span>
          </div>
          <p className="text-xs text-text-muted max-w-md">
            The system will automatically parse and separate Course Outlines and Schemes of Work for each unit.
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-text-muted pt-1">
            <span className="inline-flex items-center gap-1">
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Excel Workbook (.xlsx)
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Archive className="size-3.5 text-indigo-600" />
              Word Outlines ZIP (.zip)
            </span>
          </div>
        </label>
      </Card>

      {/* Error Alert */}
      {errorMessage && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-danger flex items-start gap-3 text-xs">
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Upload Error</span>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-success flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Published Successfully</div>
              <p>{successMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              leadingIcon={<RefreshCw className="size-3.5" />}
            >
              Upload Another File
            </Button>
            <Link
              href="/teaching-documents/curriculum"
              className="inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 transition"
            >
              View Curriculum Library
            </Link>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {parseResult && parseResult.units.length > 0 && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Extracted Curriculum Preview
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Source: <span className="font-semibold text-text-primary">{parseResult.fileName}</span> ({parseResult.totalUnits} documents detected)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">
                {parseResult.matchedCount} Matched Units
              </Badge>
              {parseResult.unmatchedCount > 0 && (
                <Badge variant="warning">
                  {parseResult.unmatchedCount} Unmatched
                </Badge>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {parseResult.units.map((unit, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 text-xs hover:bg-surface-subtle transition"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary text-sm">
                      {unit.unitCode}
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {unit.documentType === 'scheme_of_work' ? 'Scheme of Work' : 'Course Outline'}
                    </span>
                    <span className="text-text-muted truncate">
                      {unit.unitName}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <FileText className="size-3 text-text-tertiary" />
                      {unit.topics.length} Topic{unit.topics.length === 1 ? '' : 's'}
                    </span>
                    {unit.unitDescription && (
                      <span className="truncate max-w-md text-text-tertiary">
                        • {unit.unitDescription}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  {unit.status === 'matched' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="size-3.5" />
                      Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                      New Unit
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {parseResult.issues.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4 space-y-1.5">
              <p className="text-xs font-bold text-text-secondary">Validation Notes:</p>
              <ul className="text-xs text-text-muted space-y-1 list-disc pl-4">
                {parseResult.issues.slice(0, 8).map((iss, i) => (
                  <li key={i}>{iss.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-text-muted">
              {hasValidationErrors
                ? 'Resolve validation issues before publishing'
                : `${parseResult.units.length} curriculum documents ready to publish`}
            </span>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isParsing || isCommitting}
              >
                Reset
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleCommit}
                disabled={
                  !parseResult ||
                  parseResult.units.length === 0 ||
                  hasValidationErrors ||
                  isCommitting ||
                  isParsing
                }
                leadingIcon={
                  isCommitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )
                }
              >
                {isCommitting
                  ? 'Publishing Documents...'
                  : `Publish All (${parseResult.units.length}) Documents`}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
