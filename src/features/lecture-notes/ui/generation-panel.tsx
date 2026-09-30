'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { GenerationGranularity } from '../types';

interface GeneratedSection {
  heading: string;
  body: string;
}

interface GenerationResult {
  jobId: string;
  topic: string;
  granularity: GenerationGranularity;
  sessionWeek: number | null;
  sections: GeneratedSection[];
  sourceMaterials: string[];
  chunkCount: number;
  promptTokens: number;
  outputTokens: number;
  docxStoragePath: string | null;
  generatedAt: string;
}

interface GenerationPanelProps {
  unitId: string;
  unitCode: string;
  unitName: string;
  teachingAllocationId?: string | null;
  topics: string[];
  materialCount: number;
}

export function GenerationPanel({
  unitId,
  unitCode,
  unitName,
  teachingAllocationId,
  topics,
  materialCount,
}: GenerationPanelProps) {
  const [granularity, setGranularity] = useState<GenerationGranularity>('session');
  const [sessionWeek, setSessionWeek] = useState<number>(1);
  const [customTopic, setCustomTopic] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(topics[0] ?? '');
  const [useCustomTopic, setUseCustomTopic] = useState(topics.length === 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [downloading, setDownloading] = useState(false);

  const effectiveTopic = useCustomTopic ? customTopic : selectedTopic;

  async function handleGenerate() {
    if (!effectiveTopic.trim()) {
      setError('Please specify a topic to generate notes for.');
      return;
    }
    if (materialCount === 0) {
      setError('Please add at least one source material before generating. Notes must be grounded in your uploaded content.');
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
          granularity,
          sessionWeek: granularity === 'session' ? sessionWeek : null,
          topic: effectiveTopic.trim(),
        }),
      });

      const json = await response.json() as GenerationResult & { error?: string };

      if (!response.ok || json.error) {
        throw new Error(json.error ?? 'Generation failed.');
      }

      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(format: 'docx') {
    if (!result?.jobId) return;
    setDownloading(true);
    try {
      const response = await fetch(`/api/lecture-notes/download?jobId=${result.jobId}&format=${format}`);
      const json = await response.json() as { downloadUrl?: string; filename?: string; error?: string };

      if (!response.ok || !json.downloadUrl) {
        throw new Error(json.error ?? 'Download failed.');
      }

      // Open signed URL in new tab to trigger browser download
      const a = document.createElement('a');
      a.href = json.downloadUrl;
      a.download = json.filename ?? `lecture-notes.${format}`;
      a.target = '_blank';
      a.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Configuration */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Generate Notes</p>

        {/* Granularity */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Scope</label>
            <Select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as GenerationGranularity)}
            >
              <option value="session">Single session (by week)</option>
              <option value="unit">Full unit / entire course</option>
            </Select>
          </div>

          {granularity === 'session' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Week number</label>
              <input
                type="number"
                min={1}
                max={52}
                value={sessionWeek}
                onChange={(e) => setSessionWeek(Number(e.target.value))}
                className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>

        {/* Topic */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">
              Topic <span className="text-danger">*</span>
            </label>
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
              className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-[12px] text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 xl:text-sm"
            />
          ) : (
            <Select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
              {topics.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          )}
        </div>

        {/* Warning if no materials */}
        {materialCount === 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-surface px-3 py-2.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>Add source materials first. Notes must be fully grounded — no materials means no output.</span>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={loading || !effectiveTopic.trim()}
          leadingIcon={loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          className="w-full sm:w-auto"
        >
          {loading ? 'Generating…' : 'Generate lecture notes'}
        </Button>

        {loading && (
          <p className="text-xs text-text-muted">
            Retrieving relevant content from your materials and calling Gemini 1.5 Pro. This typically takes 20–60 seconds.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Success header */}
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-success-border bg-success-surface px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="size-4" />
              Notes generated — {result.chunkCount} source chunk{result.chunkCount === 1 ? '' : 's'} used
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload('docx')}
                disabled={downloading || !result.docxStoragePath}
                leadingIcon={downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              >
                Download DOCX
              </Button>
            </div>
          </div>

          {/* Source materials used */}
          {result.sourceMaterials.length > 0 && (
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Source materials used
              </p>
              <ul className="space-y-1">
                {result.sourceMaterials.map((title) => (
                  <li key={title} className="flex items-center gap-2 text-xs text-text-secondary">
                    <FileText className="size-3.5 shrink-0 text-primary" />
                    {title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes preview */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border bg-surface-subtle px-4 py-2.5 flex items-center gap-2">
              <Zap className="size-4 text-primary" />
              <span className="text-xs font-semibold text-text-primary">Preview</span>
              <span className="ml-auto text-[10px] text-text-muted">
                {result.promptTokens.toLocaleString()} prompt · {result.outputTokens.toLocaleString()} output tokens
              </span>
            </div>
            <div className="divide-y divide-border-soft">
              {result.sections.map((section) => (
                <div key={section.heading} className="px-4 py-4">
                  <h3 className="mb-2 text-sm font-bold text-text-primary">{section.heading}</h3>
                  <div className="prose prose-sm max-w-none text-text-secondary">
                    {section.body.split('\n').map((line, i) => {
                      if (!line.trim()) return <br key={i} />;
                      if (line.startsWith('[No source material')) {
                        return (
                          <p key={i} className="rounded bg-warning-surface px-2 py-1 text-xs font-medium text-warning">
                            {line}
                          </p>
                        );
                      }
                      if (line.startsWith('- ') || line.startsWith('* ')) {
                        return <p key={i} className="ml-4 text-xs before:mr-1 before:content-['•']">{line.slice(2)}</p>;
                      }
                      return <p key={i} className="text-xs">{line}</p>;
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
