'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface GeneratedSection {
  heading: string;
  body: string;
}

interface GenerationResult {
  jobId: string;
  topic: string;
  sections: GeneratedSection[];
  sourceMaterials: string[];
  chunkCount: number;
  docxStoragePath: string | null;
  pdfStoragePath: string | null;
  generatedAt: string;
  generationMode?: 'unified' | 'ai';
  materialCount?: number;
  sourceWordCount?: number;
  retainedWordCount?: number;
  duplicateParagraphCount?: number;
  status?: 'pending' | 'processing' | 'done' | 'error';
  error?: string | null;
}

interface GenerationPanelProps {
  unitId: string;
  unitCode: string;
  unitName: string;
  teachingAllocationId?: string | null;
  topics: string[];
  materialCount: number;
  processingCount?: number;
}

export function GenerationPanel({
  unitId,
  unitCode,
  unitName,
  teachingAllocationId,
  topics,
  materialCount,
  processingCount = 0,
}: GenerationPanelProps) {
  const [generationMode, setGenerationMode] = useState<'unified' | 'ai'>('unified');
  const [customTopic, setCustomTopic] = useState('Full Unit');
  const [selectedTopic, setSelectedTopic] = useState(topics[0] ?? 'Full Unit');
  const [useCustomTopic, setUseCustomTopic] = useState(topics.length === 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'docx' | 'pdf' | null>(null);

  const effectiveTopic = generationMode === 'unified'
    ? (customTopic.trim() || 'Full Unit')
    : (useCustomTopic ? customTopic : selectedTopic);

  async function handleGenerate() {
    if (!effectiveTopic.trim()) {
      setError('Please select or type a topic to generate notes for.');
      return;
    }
    if (generationMode === 'unified' && materialCount === 0) {
      setError('Upload and wait for all source materials to become Ready before creating the unified unit notes.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/lecture-notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          teachingAllocationId: teachingAllocationId ?? null,
          generationMode,
          granularity: generationMode === 'unified' ? 'unit' : 'session',
          sessionWeek: null,
          topic: effectiveTopic.trim(),
        }),
      });

      const json = await response.json() as GenerationResult & { error?: string };
      if (!response.ok || json.error) throw new Error(json.error ?? 'Generation failed.');

      if (generationMode === 'unified') {
        setResult(json);
        let status = json.status ?? 'pending';
        for (let attempt = 0; attempt < 600 && status !== 'done' && status !== 'error'; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 3000));
          const statusResponse = await fetch(`/api/lecture-notes/jobs/${json.jobId}`, { cache: 'no-store' });
          const statusJson = await statusResponse.json() as GenerationResult & { error?: string };
          if (!statusResponse.ok) throw new Error(statusJson.error ?? 'Could not read the notes-engine job status.');
          status = statusJson.status ?? 'processing';
          setResult((current) => ({ ...current, ...statusJson }));
          if (status === 'error') throw new Error(statusJson.error ?? 'Failed to build the unified notes.');
        }
        if (status !== 'done') throw new Error('The unified notes job is taking longer than expected. You can refresh the page and check the job status.');
      } else {
        setResult(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(format: 'docx' | 'pdf') {
    if (!result?.jobId) return;
    setDownloadingFormat(format);
    try {
      const response = await fetch(`/api/lecture-notes/download?jobId=${result.jobId}&format=${format}`);
      const json = await response.json() as { downloadUrl?: string; filename?: string; error?: string };
      if (!response.ok || !json.downloadUrl) throw new Error(json.error ?? 'Download failed.');
      const a = document.createElement('a');
      a.href = json.downloadUrl;
      a.download = json.filename ?? `lecture-notes.${format}`;
      a.target = '_blank';
      a.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingFormat(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">Generation method</label>
          <span className="text-[10px] text-text-muted">Complete source coverage first</span>
        </div>

        <Select value={generationMode} onChange={(e) => setGenerationMode(e.target.value as 'unified' | 'ai')}>
          <option value="unified">Unified full unit — read every ready source</option>
          <option value="ai">AI-assisted topic notes — semantic retrieval</option>
        </Select>

        {generationMode === 'unified' ? (
          <>
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g. Full Unit Notes"
              className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-text-muted">
              The engine reads the <strong>complete extracted text</strong> from every Ready source, removes exact duplicate passages, and retains materially different content. No Gemini call is required.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">Topic</label>
              {topics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUseCustomTopic(!useCustomTopic)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {useCustomTopic ? '← Pick from outline' : 'Type custom topic'}
                </button>
              )}
            </div>
            {useCustomTopic || topics.length === 0 ? (
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g. Macronutrient requirements in clinical nutrition"
                className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            ) : (
              <Select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
                {topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </>
        )}

        {materialCount > 0 && (
          <p className="text-[11px] text-text-muted">
            <span className="font-medium text-primary">{materialCount}</span> source file{materialCount === 1 ? '' : 's'} ready to be read.
          </p>
        )}

        {generationMode === 'unified' && materialCount === 0 && processingCount === 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-text-secondary">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="font-medium text-text-primary">Source materials required</p>
              <p className="text-text-muted leading-relaxed">
                Upload your lecture notes, slides, or a ZIP archive in the <strong>Source materials</strong> box above. Once indexed and marked <strong>Ready</strong>, the unified builder will activate to consolidate them.
              </p>
            </div>
          </div>
        )}

        {processingCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-text-secondary">
            <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" />
            <span>
              {processingCount} source {processingCount === 1 ? 'file is' : 'files are'} still indexing. Unified generation will enable as soon as processing finishes.
            </span>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={loading || processingCount > 0 || (generationMode === 'unified' && materialCount === 0) || !effectiveTopic.trim()}
          leadingIcon={loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          className="w-full"
        >
          {loading
            ? (generationMode === 'unified' ? 'Building unified notes…' : 'Generating notes…')
            : generationMode === 'unified'
              ? materialCount === 0
                ? processingCount > 0
                  ? 'Indexing sources…'
                  : 'Add sources above to build unified notes'
                : `Build unified unit notes (${materialCount} source${materialCount === 1 ? '' : 's'})`
              : 'Generate AI notes'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success-border bg-success-surface px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="size-4" />
              {result.generationMode === 'unified' && result.status !== 'done' ? `Unified notes ${result.status ?? 'processing'}` : result.generationMode === 'unified' ? 'Unified notes ready' : 'AI notes ready'}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleDownload('docx')} disabled={downloadingFormat === 'docx' || !result.docxStoragePath} leadingIcon={downloadingFormat === 'docx' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}>Word</Button>
              <Button size="sm" variant="outline" onClick={() => handleDownload('pdf')} disabled={downloadingFormat === 'pdf' || !result.pdfStoragePath} leadingIcon={downloadingFormat === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}>PDF</Button>
            </div>
          </div>

          {result.generationMode === 'unified' && (
            <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-[11px] text-text-secondary">
              Read {result.materialCount ?? result.sourceMaterials.length} source file{(result.materialCount ?? result.sourceMaterials.length) === 1 ? '' : 's'} · approximately {result.sourceWordCount?.toLocaleString() ?? '—'} source words · {result.duplicateParagraphCount ?? 0} exact duplicates removed.
            </div>
          )}

          {result.sourceMaterials.length > 0 && (
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface-subtle px-3 py-2">
              {result.sourceMaterials.map((title) => (
                <span key={title} className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-text-secondary">
                  <FileText className="size-3 shrink-0 text-primary" />{title}
                </span>
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-2 border-b border-border bg-surface-subtle px-4 py-2">
              <Sparkles className="size-3.5 text-primary" />
              <span className="text-xs font-semibold text-text-primary">Preview — {result.topic}</span>
            </div>
            <div className="max-h-[60vh] divide-y divide-border-soft overflow-y-auto">
              {result.sections.map((section, index) => (
                <div key={`${section.heading}-${index}`} className="px-4 py-4">
                  <h3 className="mb-2 text-sm font-bold text-text-primary">{section.heading}</h3>
                  <div className="space-y-1">
                    {section.body.split('\n').map((line, i) => {
                      if (!line.trim()) return null;
                      if (line.startsWith('- ') || line.startsWith('* ')) return <p key={i} className="ml-3 text-xs text-text-secondary before:mr-1.5 before:content-['•']">{line.slice(2)}</p>;
                      if (line.startsWith('### ')) return <p key={i} className="mt-2 text-xs font-semibold text-text-primary">{line.slice(4)}</p>;
                      return <p key={i} className="text-xs text-text-secondary">{line}</p>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
