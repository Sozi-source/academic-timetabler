'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
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
  promptTokens?: number;
  outputTokens?: number;
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

type MethodMode = 'ai_full' | 'ai_topic' | 'unified';

export function GenerationPanel({
  unitId,
  unitCode,
  unitName,
  teachingAllocationId,
  topics,
  materialCount,
  processingCount = 0,
}: GenerationPanelProps) {
  const [methodMode, setMethodMode] = useState<MethodMode>('ai_full');
  const [customTopic, setCustomTopic] = useState('Full Unit Notes');
  const [selectedTopic, setSelectedTopic] = useState(topics[0] ?? 'Full Unit Notes');
  const [useCustomTopic, setUseCustomTopic] = useState(topics.length === 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'docx' | 'pdf' | null>(null);

  // NotebookLM companion state
  const [exportingNotebookLM, setExportingNotebookLM] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [notebookLmNotice, setNotebookLmNotice] = useState<string | null>(null);

  const effectiveTopic = methodMode === 'ai_topic'
    ? (useCustomTopic ? customTopic : selectedTopic)
    : (customTopic.trim() || 'Full Unit Notes');

  async function handleGenerate() {
    if (!effectiveTopic.trim()) {
      setError('Please select or type a topic to generate notes for.');
      return;
    }
    if ((methodMode === 'ai_full' || methodMode === 'unified') && materialCount === 0) {
      setError('Upload and wait for all source materials to become Ready before generating full unit notes.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const generationMode = methodMode === 'unified' ? 'unified' : 'ai';
    const granularity = methodMode === 'ai_topic' ? 'session' : 'unit';

    try {
      const response = await fetch('/api/lecture-notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          teachingAllocationId: teachingAllocationId ?? null,
          generationMode,
          granularity,
          sessionWeek: null,
          topic: effectiveTopic.trim(),
        }),
      });

      const json = await response.json() as GenerationResult & { error?: string };
      if (!response.ok || json.error) throw new Error(json.error ?? 'Generation failed.');

      if (generationMode === 'unified' && json.status !== 'done') {
        setResult(json);
        let status: GenerationResult['status'] = json.status ?? 'pending';
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

  async function handleLaunchNotebookLM() {
    setExportingNotebookLM(true);
    setNotebookLmNotice(null);
    try {
      const res = await fetch(`/api/lecture-notes/notebooklm?unitId=${encodeURIComponent(unitId)}`);
      const data = await res.json() as { masterPrompt?: string; downloadUrl?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to prepare NotebookLM bundle.');

      if (data.masterPrompt && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(data.masterPrompt);
        setCopiedPrompt(true);
        window.setTimeout(() => setCopiedPrompt(false), 4000);
      }

      if (data.downloadUrl) {
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.target = '_blank';
        a.click();
      }

      window.open('https://notebooklm.google.com', '_blank', 'noopener,noreferrer');
      setNotebookLmNotice('Source bundle downloaded & master TVET prompt copied to clipboard! In NotebookLM, create a notebook, add the source file, and paste the prompt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export to NotebookLM.');
    } finally {
      setExportingNotebookLM(false);
    }
  }

  async function handleCopyPrompt() {
    setExportingNotebookLM(true);
    try {
      const res = await fetch(`/api/lecture-notes/notebooklm?unitId=${encodeURIComponent(unitId)}`);
      const data = await res.json() as { masterPrompt?: string; error?: string };
      if (!res.ok || !data.masterPrompt) throw new Error(data.error ?? 'Failed to fetch prompt.');
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(data.masterPrompt);
        setCopiedPrompt(true);
        window.setTimeout(() => setCopiedPrompt(false), 4000);
      }
      setNotebookLmNotice('TVET master prompt copied to clipboard!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy prompt.');
    } finally {
      setExportingNotebookLM(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Primary In-App Generator Card */}
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">Generation method</label>
          <span className="text-[10px] text-text-muted">Long-Context Grounded Engine</span>
        </div>

        <Select value={methodMode} onChange={(e) => setMethodMode(e.target.value as MethodMode)}>
          <option value="ai_full">AI Full Unit — Gemini Long-Context (NotebookLM Mode)</option>
          <option value="ai_topic">AI Topic-Focused — Grounded on syllabus topic</option>
          <option value="unified">Deterministic Full Unit — Merge text only (No AI)</option>
        </Select>

        {methodMode === 'ai_full' && (
          <>
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g. Full Unit Notes"
              className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-text-muted leading-relaxed">
              <strong>NotebookLM Paradigm:</strong> Gemini reads the <strong>complete extracted text</strong> from all Ready sources in a single long-context window (up to 1M tokens), removes duplicates, and generates structured, TVET-aligned lecture notes directly into Word and PDF.
            </p>
          </>
        )}

        {methodMode === 'ai_topic' && (
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
            <p className="text-[11px] text-text-muted">
              Synthesizes deep lecture notes focused specifically on the selected syllabus topic, grounded in all uploaded reference materials.
            </p>
          </>
        )}

        {methodMode === 'unified' && (
          <>
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g. Full Unit Notes"
              className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-text-muted">
              The engine reads the complete extracted text from every Ready source, removes exact duplicate paragraphs, and compiles the text deterministically without AI tokens.
            </p>
          </>
        )}

        {materialCount > 0 && (
          <p className="text-[11px] text-text-muted">
            <span className="font-medium text-primary">{materialCount}</span> source file{materialCount === 1 ? '' : 's'} ready to be read.
          </p>
        )}

        {(methodMode === 'ai_full' || methodMode === 'unified') && materialCount === 0 && processingCount === 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-text-secondary">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="font-medium text-text-primary">Source materials required</p>
              <p className="text-text-muted leading-relaxed">
                Upload your lecture notes, slides, or a ZIP archive in the <strong>Source materials</strong> box above. Once indexed and marked <strong>Ready</strong>, the generation engine will activate to synthesize them.
              </p>
            </div>
          </div>
        )}

        {processingCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-text-secondary">
            <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" />
            <span>
              {processingCount} source {processingCount === 1 ? 'file is' : 'files are'} still indexing. Generation will enable as soon as processing finishes.
            </span>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={loading || processingCount > 0 || ((methodMode === 'ai_full' || methodMode === 'unified') && materialCount === 0) || !effectiveTopic.trim()}
          leadingIcon={loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          className="w-full"
        >
          {loading
            ? (methodMode === 'unified' ? 'Building unified notes…' : 'Synthesizing lecture notes…')
            : methodMode === 'ai_full'
              ? materialCount === 0
                ? processingCount > 0
                  ? 'Indexing sources…'
                  : 'Add sources above to generate notes'
                : `Generate full unit notes (${materialCount} source${materialCount === 1 ? '' : 's'})`
              : methodMode === 'ai_topic'
                ? 'Generate AI topic notes'
                : `Build unified unit notes (${materialCount} source${materialCount === 1 ? '' : 's'})`}
        </Button>
      </div>

      {/* Google NotebookLM Companion Card */}
      <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-indigo-500" />
            <span className="text-xs font-semibold text-text-primary">Google NotebookLM Companion</span>
          </div>
          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
            Interactive Cloud UI
          </span>
        </div>
        <p className="text-xs leading-relaxed text-text-secondary">
          Prefer Google&apos;s interactive NotebookLM workspace for Audio Overview podcasts, interactive Q&amp;A citations, or study guides? Export your curated source package and TVET master prompt in one click.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleLaunchNotebookLM}
            disabled={exportingNotebookLM || materialCount === 0}
            leadingIcon={exportingNotebookLM ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5 text-indigo-500" />}
            className="border-indigo-500/30 hover:bg-indigo-500/10"
          >
            Launch in NotebookLM
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyPrompt}
            disabled={exportingNotebookLM}
            leadingIcon={copiedPrompt ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          >
            {copiedPrompt ? 'Prompt copied!' : 'Copy TVET prompt'}
          </Button>
        </div>
        {notebookLmNotice && (
          <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            {notebookLmNotice}
          </p>
        )}
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
              {result.generationMode === 'unified' && result.status !== 'done'
                ? `Unified notes ${result.status ?? 'processing'}`
                : result.generationMode === 'unified'
                  ? 'Unified notes ready'
                  : 'AI notes ready (Long-Context)'}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload('docx')}
                disabled={downloadingFormat === 'docx' || !result.docxStoragePath}
                leadingIcon={downloadingFormat === 'docx' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              >
                Word
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload('pdf')}
                disabled={downloadingFormat === 'pdf' || !result.pdfStoragePath}
                leadingIcon={downloadingFormat === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              >
                PDF
              </Button>
            </div>
          </div>

          {result.generationMode === 'ai' && ((result.promptTokens ?? 0) > 0 || (result.outputTokens ?? 0) > 0) && (
            <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-[11px] text-text-secondary flex items-center justify-between">
              <span>✨ Synthesized with Gemini Long-Context</span>
              <span className="font-mono text-[10px] text-text-muted">
                {result.promptTokens?.toLocaleString()} input tokens · {result.outputTokens?.toLocaleString()} output tokens
              </span>
            </div>
          )}

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
