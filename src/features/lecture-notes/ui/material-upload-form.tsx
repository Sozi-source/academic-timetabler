'use client';

import { useState, useRef } from 'react';
import { FileText, Globe, Loader2, Paperclip, Plus, Trash2, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Material {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  original_filename: string | null;
  chunk_count: number;
  ingested_at: string | null;
  created_at: string;
}

interface MaterialUploadFormProps {
  unitId: string;
  teachingAllocationId?: string | null;
  onMaterialAdded: (material: Material) => void;
}

type SourceTab = 'file' | 'url' | 'text';

export function MaterialUploadForm({
  unitId,
  teachingAllocationId,
  onMaterialAdded,
}: MaterialUploadFormProps) {
  const [activeTab, setActiveTab] = useState<SourceTab>('file');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a title for this material.');
      return;
    }

    if (activeTab === 'file' && !file) {
      setError('Please select a file.');
      return;
    }
    if (activeTab === 'url' && !url.trim()) {
      setError('Please enter a URL.');
      return;
    }
    if (activeTab === 'text' && !textContent.trim()) {
      setError('Please paste some text content.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('unitId', unitId);
      if (teachingAllocationId) formData.append('teachingAllocationId', teachingAllocationId);
      formData.append('title', title.trim());

      if (activeTab === 'file' && file) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        formData.append('sourceType', ext === 'pdf' ? 'pdf' : 'docx');
        formData.append('file', file);
      } else if (activeTab === 'url') {
        formData.append('sourceType', 'url');
        formData.append('sourceUrl', url.trim());
      } else {
        formData.append('sourceType', 'text');
        formData.append('textContent', textContent.trim());
      }

      const response = await fetch('/api/lecture-notes/ingest', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json() as { materialId?: string; chunkCount?: number; error?: string };

      if (!response.ok || !json.materialId) {
        throw new Error(json.error ?? 'Ingestion failed.');
      }

      // Optimistic mock for the parent list
      onMaterialAdded({
        id: json.materialId,
        title: title.trim(),
        source_type: activeTab === 'file' ? (file?.name.endsWith('.pdf') ? 'pdf' : 'docx') : activeTab,
        source_url: activeTab === 'url' ? url.trim() : null,
        original_filename: file?.name ?? null,
        chunk_count: json.chunkCount ?? 0,
        ingested_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      // Reset form
      setTitle('');
      setUrl('');
      setTextContent('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: SourceTab; label: string; icon: React.ReactNode }[] = [
    { id: 'file', label: 'File', icon: <Paperclip className="size-3.5" /> },
    { id: 'url', label: 'URL', icon: <Globe className="size-3.5" /> },
    { id: 'text', label: 'Paste text', icon: <Type className="size-3.5" /> },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-surface-subtle p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Add Source Material</p>

      {/* Tab selector */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-text-secondary hover:bg-surface-subtle'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">
          Material title <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. WHO Nutrition Guidelines Chapter 3"
          className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-[12px] text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 xl:text-sm"
          required
        />
      </div>

      {/* Source-specific input */}
      {activeTab === 'file' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            PDF or DOCX file
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/10"
          />
        </div>
      )}

      {activeTab === 'url' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Web URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-[12px] text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 xl:text-sm"
          />
        </div>
      )}

      {activeTab === 'text' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Paste content
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Paste notes, transcripts, or any text content here…"
            rows={6}
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-[12px] text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 xl:text-sm"
          />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-danger-surface px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <Button type="submit" size="sm" disabled={loading} leadingIcon={loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}>
        {loading ? 'Processing…' : 'Add material'}
      </Button>

      {loading && (
        <p className="text-xs text-text-muted">
          Extracting text and generating embeddings — this may take 10–30 seconds for large files.
        </p>
      )}
    </form>
  );
}

// ── Material list item ─────────────────────────────────────────

function sourceIcon(type: string) {
  switch (type) {
    case 'pdf': return <FileText className="size-4 text-danger" />;
    case 'docx': return <FileText className="size-4 text-primary" />;
    case 'url': return <Globe className="size-4 text-text-muted" />;
    default: return <Type className="size-4 text-text-muted" />;
  }
}

interface MaterialListProps {
  materials: Material[];
  onDelete: (id: string) => void;
}

export function MaterialList({ materials, onDelete }: MaterialListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/lecture-notes/materials?materialId=${id}`, { method: 'DELETE' });
      onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  if (materials.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
        <FileText className="mx-auto size-8 text-text-subtle" />
        <p className="mt-2 text-sm font-medium text-text-secondary">No materials yet</p>
        <p className="mt-1 text-xs text-text-muted">Add PDFs, DOCX files, URLs or paste text to ground your lecture notes.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {materials.map((m) => (
        <li
          key={m.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
        >
          <div className="shrink-0">{sourceIcon(m.source_type)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{m.title}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {m.original_filename ?? m.source_url ?? m.source_type}
              {m.chunk_count > 0 && <span className="ml-2">· {m.chunk_count} chunks</span>}
            </p>
          </div>
          {m.ingested_at ? (
            <Badge variant="success" dot className="shrink-0">Ready</Badge>
          ) : (
            <Badge variant="warning" className="shrink-0">Pending</Badge>
          )}
          <button
            type="button"
            onClick={() => handleDelete(m.id)}
            disabled={deletingId === m.id}
            className="shrink-0 rounded-lg p-1.5 text-text-muted transition hover:bg-danger-surface hover:text-danger"
            aria-label={`Delete ${m.title}`}
          >
            {deletingId === m.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
