'use client';

import { useState, useTransition } from 'react';
import {
  Archive,
  CheckCircle2,
  FileCheck2,
  UploadCloud,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { UnitCurriculumDefinition } from './curriculum-registry';
import {
  commitIngestedCurriculumAction,
  previewCurriculumZipAction,
} from './zip-ingestion-actions';

export function CurriculumZipUploadDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCommitting, startCommitTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [extractedUnits, setExtractedUnits] = useState<UnitCurriculumDefinition[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setSuccessMessage('');
    setExtractedUnits([]);

    const formData = new FormData();
    formData.append('zipFile', file);

    startTransition(async () => {
      const res = await previewCurriculumZipAction(formData);
      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to process ZIP archive.');
      } else {
        setExtractedUnits(res.extractedUnits || []);
        setTotalFiles(res.totalFilesProcessed || 0);
      }
    });
  };

  const handleCommit = () => {
    if (extractedUnits.length === 0) return;

    startCommitTransition(async () => {
      const res = await commitIngestedCurriculumAction(extractedUnits);
      if (res.ok) {
        setSuccessMessage(`Successfully registered and standardized ${res.count} units into the TVET curriculum system!`);
        setExtractedUnits([]);
      } else {
        setErrorMessage(res.error || 'Failed to commit standardized units.');
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setErrorMessage('');
          setSuccessMessage('');
          setExtractedUnits([]);
        }}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover"
      >
        <Archive className="size-4" />
        Bulk Ingest Documents (.zip)
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UploadCloud className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-text-primary">
                    Bulk Ingest TVET Course Outlines & Schemes
                  </h2>
                  <p className="text-xs text-text-muted">
                    Upload a .zip file containing raw Word (.docx), Excel (.xlsx), or text documents.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-subtle"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Error / Success feedback */}
            {errorMessage && (
              <div className="mt-4 rounded-lg bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-success-subtle px-3 py-2.5 text-xs font-semibold text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                {successMessage}
              </div>
            )}

            {/* Drag & drop upload area */}
            <div className="mt-4">
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-strong bg-surface-subtle/50 px-6 py-8 text-center cursor-pointer transition hover:border-primary/50 hover:bg-surface-subtle">
                <Archive className="size-10 text-text-muted opacity-50" />
                <span className="mt-2 text-xs font-bold text-text-primary">
                  Select or drop your curriculum .zip archive here
                </span>
                <span className="mt-1 text-[11px] text-text-muted">
                  Supports .docx, .xlsx, .txt, .json archives
                </span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={handleFileChange}
                  disabled={isPending || isCommitting}
                  className="hidden"
                />
              </label>
              {isPending && (
                <p className="mt-2 text-center text-xs font-semibold text-primary animate-pulse">
                  Decompressing archive, extracting curriculum topics, and polishing to TVET standard...
                </p>
              )}
            </div>

            {/* Ingested Units Preview Table */}
            {extractedUnits.length > 0 && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Detected & Standardised Units ({extractedUnits.length} from {totalFiles} files)
                  </h3>
                  <Badge variant="success">Standardised to TVET 14-Weeks</Badge>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-surface-subtle text-[10px] font-bold uppercase text-text-muted">
                      <tr>
                        <th className="p-2.5">Unit Code</th>
                        <th className="p-2.5">Unit Title</th>
                        <th className="p-2.5 text-center">Topics</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {extractedUnits.map((u, i) => (
                        <tr key={i} className="hover:bg-surface-subtle/50">
                          <td className="p-2.5 font-bold text-text-primary">
                            {u.unitCode}
                          </td>
                          <td className="p-2.5 font-medium text-text-secondary truncate max-w-[200px]">
                            {u.unitName}
                          </td>
                          <td className="p-2.5 text-center text-text-muted">
                            {u.weeklySchedule?.length ?? 14} Weeks
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success">
                              <FileCheck2 className="size-3" /> Ready
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-text-muted hover:bg-surface-subtle"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCommit}
                    disabled={isCommitting}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-60"
                  >
                    {isCommitting ? 'Registering...' : `Confirm & Register ${extractedUnits.length} Units`}
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
