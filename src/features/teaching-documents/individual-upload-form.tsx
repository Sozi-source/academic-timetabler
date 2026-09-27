'use client';

import { useState, useTransition, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileUp,
  FileText,
  Loader2,
  Search,
  ChevronsUpDown,
  Check,
  X,
  UploadCloud,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils/cn';
import {
  parseIndividualCurriculumAction,
  publishIndividualCurriculumAction,
  type IndividualTopicItem,
} from './individual-curriculum-actions';
import {
  isCurriculumDocumentType,
  type CurriculumDocumentType,
} from './curriculum-document-types';

export interface SystemUnitOption {
  id: string;
  code: string;
  name: string;
}

interface IndividualUploadFormProps {
  units: SystemUnitOption[];
  initialUnitId?: string;
  initialDocumentType: CurriculumDocumentType;
}

/** Searchable Unit Selector allowing users to filter and select units */
function SearchableUnitSelect({
  units,
  selectedUnitId,
  onSelectUnit,
}: {
  units: SystemUnitOption[];
  selectedUnitId: string;
  onSelectUnit: (unitId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId),
    [units, selectedUnitId]
  );

  const filteredUnits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.code.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q)
    );
  }, [units, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return next;
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
        Target Department Unit
      </label>

      <button
        type="button"
        onClick={handleOpen}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 text-left text-xs font-semibold text-text-primary shadow-xs hover:border-border-strong focus:border-primary focus:outline-none transition"
      >
        <span className="truncate">
          {selectedUnit ? (
            <span className="flex items-center gap-2 truncate">
              <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-800">
                {selectedUnit.code}
              </span>
              <span className="truncate font-medium text-slate-700">{selectedUnit.name}</span>
            </span>
          ) : (
            <span className="text-text-muted italic">+ Custom / Unlisted Unit</span>
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-text-muted" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] sm:min-w-[360px] rounded-xl border border-slate-300 bg-white p-2 shadow-2xl animate-in fade-in-0 zoom-in-95">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code or title (e.g. DHN, Anatomy)..."
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 text-xs">
            <button
              type="button"
              onClick={() => {
                onSelectUnit('');
                setIsOpen(false);
                setSearchQuery('');
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition',
                !selectedUnitId ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-600'
              )}
            >
              <span>+ Custom / Unlisted Unit</span>
              {!selectedUnitId && <Check className="size-3.5 text-slate-900" />}
            </button>

            <div className="border-t border-slate-100 my-1" />

            {filteredUnits.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No units match &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredUnits.map((u) => {
                const isSelected = u.id === selectedUnitId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onSelectUnit(u.id);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition',
                      isSelected ? 'bg-slate-900 text-white font-bold' : 'hover:bg-slate-100 text-slate-900'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black',
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                        )}
                      >
                        {u.code}
                      </span>
                      <span className="truncate text-xs">{u.name}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 shrink-0 text-white" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-2 border-t border-slate-100 pt-1.5 px-1 text-[10px] text-slate-500 flex justify-between">
            <span>{filteredUnits.length} units available</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-800 hover:underline font-semibold"
              >
                Clear search
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function IndividualUploadForm({
  units = [],
  initialUnitId,
  initialDocumentType,
}: IndividualUploadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documentType, setDocumentType] = useState<CurriculumDocumentType>(initialDocumentType);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(initialUnitId || '');

  const matchedInitial = useMemo(
    () => units.find((u) => u.id === initialUnitId),
    [units, initialUnitId]
  );

  const [unitCode, setUnitCode] = useState<string>(matchedInitial?.code || '');
  const [unitName, setUnitName] = useState<string>(matchedInitial?.name || '');
  const [unitDescription, setUnitDescription] = useState<string>('');
  const [overallCompetencies, setOverallCompetencies] = useState<string>('');
  const [references, setReferences] = useState<string>('');
  const [topics, setTopics] = useState<IndividualTopicItem[]>([]);

  const [isParsing, startParsingTransition] = useTransition();
  const [isPublishing, startPublishingTransition] = useTransition();

  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileType, setUploadedFileType] = useState<'docx' | 'xlsx' | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleUnitSelect = (unitId: string) => {
    setSelectedUnitId(unitId);
    const target = units.find((u) => u.id === unitId);
    if (target) {
      setUnitCode(target.code);
      setUnitName(target.name);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setSuccessMessage('');

    const formData = new FormData();
    formData.append('file', file);

    startParsingTransition(async () => {
      try {
        const result = await parseIndividualCurriculumAction(formData);

        if (!result.ok) {
          setErrorMessage(result.error || 'Failed to parse file.');
          return;
        }

        setUploadedFileName(result.fileName);
        setUploadedFileType(result.fileType);
        setIssues(result.issues || []);

        if (result.detectedDocumentType) {
          setDocumentType(result.detectedDocumentType);
        }

        // Try matching unit if user hasn't explicitly locked a unit selection
        let matchedTarget: SystemUnitOption | undefined;
        if (result.unitCode) {
          const cleanCode = result.unitCode.toLowerCase().replace(/[^a-z0-9]/g, '');
          matchedTarget = units.find(
            (u) => u.code.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanCode
          );
        }
        if (!matchedTarget && result.unitName) {
          const cleanName = result.unitName.toLowerCase().replace(/[^a-z0-9]/g, '');
          matchedTarget = units.find(
            (u) => u.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanName
          );
        }

        if (matchedTarget) {
          setSelectedUnitId(matchedTarget.id);
          setUnitCode(matchedTarget.code);
          setUnitName(matchedTarget.name);
        } else {
          if (result.unitCode) setUnitCode(result.unitCode);
          if (result.unitName) setUnitName(result.unitName);
        }

        if (result.unitDescription) setUnitDescription(result.unitDescription);
        if (result.overallCompetencies) setOverallCompetencies(result.overallCompetencies);
        if (result.references) setReferences(result.references);
        if (result.topics && result.topics.length > 0) {
          setTopics(result.topics);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Unexpected parsing error');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    });
  };

  const handlePublish = () => {
    if (!unitCode.trim()) {
      setErrorMessage('Please specify a Unit Code (e.g. DHN 2304).');
      return;
    }

    if (topics.length === 0) {
      setErrorMessage('Please upload a document containing syllabus topics before publishing.');
      return;
    }

    setErrorMessage('');
    startPublishingTransition(async () => {
      try {
        const res = await publishIndividualCurriculumAction({
          documentType,
          unitId: selectedUnitId || undefined,
          unitCode: unitCode.trim().toUpperCase(),
          unitName: unitName.trim() || unitCode.trim().toUpperCase(),
          unitDescription: unitDescription.trim(),
          overallCompetencies: overallCompetencies.trim(),
          references: references.trim(),
          topics,
        });

        if (res.success) {
          setSuccessMessage(res.message);
          setTimeout(() => {
            router.push('/teaching-documents/curriculum');
            router.refresh();
          }, 1500);
        } else {
          setErrorMessage('Failed to publish curriculum document.');
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Publish failed');
      }
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Teaching documents"
        title="Individual Curriculum Upload"
        description="Upload a single Word (.docx) or Excel (.xlsx) course outline or scheme of work."
        icon={FileUp}
        backHref="/teaching-documents/curriculum"
        backLabel="Curriculum Content"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/teaching-documents/curriculum/bulk-upload"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition"
            >
              <UploadCloud className="size-3.5 text-primary" />
              Switch to Bulk Upload
            </Link>

            <Button
              variant="primary"
              size="sm"
              onClick={handlePublish}
              disabled={isParsing || isPublishing || !unitCode.trim() || topics.length === 0}
              leadingIcon={
                isPublishing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )
              }
            >
              {isPublishing
                ? 'Publishing...'
                : `Publish ${documentType === 'scheme_of_work' ? 'Scheme of Work' : 'Course Outline'}`}
            </Button>
          </div>
        }
      />

      {/* Alerts */}
      {errorMessage && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-danger flex items-start gap-2.5 text-xs">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Error: </span>
            {errorMessage}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-success flex items-start gap-2.5 text-xs">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <div className="font-bold">{successMessage}</div>
        </div>
      )}

      {/* Target Unit and Document Type Selection Card */}
      <Card className="p-4 bg-surface border-border overflow-visible relative z-20">
        <div className="grid gap-4 sm:grid-cols-12 items-end">
          <div className="sm:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => {
                const val = e.target.value;
                if (isCurriculumDocumentType(val)) {
                  setDocumentType(val);
                }
              }}
              className="w-full h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-text-primary focus:border-primary focus:outline-none"
            >
              <option value="course_outline">Course Outline</option>
              <option value="scheme_of_work">Scheme of Work</option>
            </select>
          </div>

          <div className="sm:col-span-5">
            <SearchableUnitSelect
              units={units}
              selectedUnitId={selectedUnitId}
              onSelectUnit={handleUnitSelect}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Unit Code
            </label>
            <input
              type="text"
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              placeholder="e.g. DHN 2304"
              className="w-full h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-text-primary focus:border-primary focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Unit Name
            </label>
            <input
              type="text"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="e.g. Biochemistry II"
              className="w-full h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-text-primary focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* File Drop and Upload Area */}
      <Card className="p-6 border-dashed border-2 border-border hover:border-primary/50 transition bg-surface/40 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx, .xlsx"
          onChange={handleFileChange}
          disabled={isParsing || isPublishing}
          className="hidden"
          id="individual-curriculum-file-input"
        />

        <label
          htmlFor="individual-curriculum-file-input"
          className="flex flex-col items-center justify-center cursor-pointer space-y-3"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white border border-border shadow-xs text-primary">
            {isParsing ? (
              <Loader2 className="size-7 animate-spin" />
            ) : (
              <FileUp className="size-7" />
            )}
          </div>

          <div>
            <span className="text-sm font-bold text-primary hover:underline">
              {isParsing ? 'Extracting syllabus content...' : 'Click to select individual document'}
            </span>
            <span className="text-sm text-text-muted"> or drag and drop here</span>
          </div>

          <div className="flex items-center justify-center gap-3 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1">
              <FileText className="size-3.5 text-blue-600" />
              Word Syllabus (.docx)
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Excel Outline (.xlsx)
            </span>
          </div>

          {uploadedFileName && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <CheckCircle2 className="size-3.5" />
              Loaded: {uploadedFileName} ({topics.length} topics detected)
            </div>
          )}
        </label>
      </Card>

      {/* Extracted Content Preview */}
      {topics.length > 0 && (
        <Card className="p-5 space-y-4 bg-white border-border">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Extracted Curriculum Preview: {unitCode} ({unitName || 'Untitled'})
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                {topics.length} weekly topics extracted. Review details below before clicking publish.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handlePublish}
              disabled={isPublishing || !unitCode.trim()}
              leadingIcon={
                isPublishing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )
              }
            >
              {isPublishing ? 'Publishing...' : 'Publish to Database'}
            </Button>
          </div>

          {/* Unit Description & Competencies */}
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            {unitDescription && (
              <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-1">
                <span className="font-bold text-text-primary uppercase text-[10px] tracking-wider">
                  Course Description / Purpose
                </span>
                <p className="text-text-secondary leading-relaxed">{unitDescription}</p>
              </div>
            )}

            {overallCompetencies && (
              <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-1">
                <span className="font-bold text-text-primary uppercase text-[10px] tracking-wider">
                  Core Competencies / Learning Outcomes
                </span>
                <p className="text-text-secondary leading-relaxed">{overallCompetencies}</p>
              </div>
            )}
          </div>

          {references && (
            <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-1 text-xs">
              <span className="font-bold text-text-primary uppercase text-[10px] tracking-wider">
                References & Textbooks
              </span>
              <p className="text-text-secondary leading-relaxed">{references}</p>
            </div>
          )}

          {/* Topics Table */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Weekly Topics Breakdown ({topics.length} items)
            </h4>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[500px] text-xs">
                <thead className="bg-surface-subtle border-b border-border text-text-muted">
                  <tr>
                    <th className="px-3 py-2 text-center w-12 font-bold">#</th>
                    <th className="px-3 py-2 text-left w-2/5 font-bold">Topic Title</th>
                    <th className="px-3 py-2 text-left font-bold">Sub-topics / Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topics.map((t, idx) => (
                    <tr key={idx} className="hover:bg-surface-subtle/50 transition">
                      <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                        {t.sequence}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 leading-snug">
                        {t.topicTitle}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 leading-relaxed">
                        {t.subTopics || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {issues.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs space-y-1">
              <span className="font-bold">Validation Notes:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                {issues.map((iss, i) => (
                  <li key={i}>{iss}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
