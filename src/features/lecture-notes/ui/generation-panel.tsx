'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
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
  const [customTopic, setCustomTopic] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(topics[0] ?? '');
  const [useCustomTopic, setUseCustomTopic] = useState(topics.length === 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'docx' | 'pdf' | null>(null);

  const effectiveTopic = useCustomTopic ? customTopic : selectedTopic;

  async function handleGenerate() {
    if (!effectiveTopic.trim()) {
      setError('Please select or type a topic to generate notes for.');
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
          granularity: 'session',
          sessionWeek: null,
          topic: effectiveTopic.trim(),
        }),
      });

      const json = await response.json() as GenerationResult & { error?: string };
      if (!response.ok || json.error) throw new Error(json.error ?? 'Generation failed.');
      setResult(json);
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
      {/* Topic selection */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Topic
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
            className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        ) : (
          <Select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
            {topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        )}

        {/* Material context hint */}
        {materialCount > 0 && (
          <p className="text-[11px] text-text-muted">
            <span className="font-medium text-primary">{materialCount}</span> source file{materialCount === 1 ? '' : 's'} will be read and unified into the notes.
          </p>
        )}

        <Button
          onClick={handleGenerate}
          disabled={loading || !effectiveTopic.trim()}
          leadingIcon={loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          className="w-full"
        >
          {loading ? 'Generating notes…' : 'Generate notes'}
        </Button>

        {loading && (
          <p className="text-xs text-text-muted text-center">
            Reading all materials and synthesizing comprehensive notes. This may take 20–40 seconds…
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
        <div className="space-y-3">
          {/* Download bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success-border bg-success-surface px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="size-4" />
              Notes ready
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

          {/* Source materials used */}
          {result.sourceMaterials.length > 0 && (
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface-subtle px-3 py-2">
              {result.sourceMaterials.map((title) => (
                <span
                  key={title}
                  className="flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[11px] text-text-secondary border border-border"
                >
                  <FileText className="size-3 shrink-0 text-primary" />
                  {title}
                </span>
              ))}
            </div>
          )}

          {/* Notes preview */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border bg-surface-subtle px-4 py-2 flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" />
              <span className="text-xs font-semibold text-text-primary">Preview — {result.topic}</span>
            </div>
            <div className="divide-y divide-border-soft max-h-[60vh] overflow-y-auto">
              {result.sections.map((section) => (
                <div key={section.heading} className="px-4 py-4">
                  <h3 className="mb-2 text-sm font-bold text-text-primary">{section.heading}</h3>
                  <div className="space-y-1">
                    {section.body.split('\n').map((line, i) => {
                      if (!line.trim()) return null;
                      if (line.startsWith('- ') || line.startsWith('* ')) {
                        return <p key={i} className="ml-3 text-xs text-text-secondary before:mr-1.5 before:content-['•']">{line.slice(2)}</p>;
                      }
                      if (line.startsWith('### ')) {
                        return <p key={i} className="text-xs font-semibold text-text-primary mt-2">{line.slice(4)}</p>;
                      }
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
