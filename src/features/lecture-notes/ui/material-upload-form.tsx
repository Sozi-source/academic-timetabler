'use client';

import { useState, useRef } from 'react';
import { FileText, Globe, Loader2, Paperclip, Trash2, Type, X } from 'lucide-react';
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
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => {
      // Merge, deduplicate by name
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...selected.filter((f) => !existing.has(f.name))];
    });
    // Reset input so same files can be re-added after removal
    if (fileRef.current) fileRef.current.value = '';
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function uploadFile(file: File): Promise<void> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const sourceType = ext === 'pdf' ? 'pdf' : 'docx';
    const formData = new FormData();
    formData.append('unitId', unitId);
    if (teachingAllocationId) formData.append('teachingAllocationId', teachingAllocationId);
    formData.append('title', file.name.replace(/\.[^.]+$/, ''));
    formData.append('sourceType', sourceType);
    formData.append('file', file);

    const response = await fetch('/api/lecture-notes/ingest', {
      method: 'POST',
      body: formData,
    });
    const json = await response.json() as { materialId?: string; chunkCount?: number; error?: string };
    if (!response.ok || !json.materialId) throw new Error(json.error ?? 'Upload failed.');

    onMaterialAdded({
      id: json.materialId,
      title: file.name.replace(/\.[^.]+$/, ''),
      source_type: sourceType,
      source_url: null,
      original_filename: file.name,
      chunk_count: json.chunkCount ?? 0,
      ingested_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (activeTab === 'file') {
      if (files.length === 0) { setError('Please select at least one file.'); return; }
      setLoading(true);
      const errors: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadingIndex(i);
        try {
          await uploadFile(files[i]);
        } catch (err) {
          errors.push(`${files[i].name}: ${err instanceof Error ? err.message : 'failed'}`);
        }
      }
      setUploadingIndex(null);
      setFiles([]);
      if (errors.length > 0) setError(errors.join('\n'));
      setLoading(false);
      return;
    }

    if (activeTab === 'url') {
      if (!url.trim()) { setError('Please enter a URL.'); return; }
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('unitId', unitId);
        if (teachingAllocationId) formData.append('teachingAllocationId', teachingAllocationId);
        formData.append('title', url.trim());
        formData.append('sourceType', 'url');
        formData.append('sourceUrl', url.trim());
        const response = await fetch('/api/lecture-notes/ingest', { method: 'POST', body: formData });
        const json = await response.json() as { materialId?: string; chunkCount?: number; error?: string };
        if (!response.ok || !json.materialId) throw new Error(json.error ?? 'Failed.');
        onMaterialAdded({
          id: json.materialId, title: url.trim(), source_type: 'url',
          source_url: url.trim(), original_filename: null,
          chunk_count: json.chunkCount ?? 0, ingested_at: new Date().toISOString(), created_at: new Date().toISOString(),
        });
        setUrl('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed.');
      } finally { setLoading(false); }
      return;
    }

    if (activeTab === 'text') {
      if (!textContent.trim()) { setError('Please paste some text content.'); return; }
      setLoading(true);
      try {
        const title = textTitle.trim() || 'Pasted notes';
        const formData = new FormData();
        formData.append('unitId', unitId);
        if (teachingAllocationId) formData.append('teachingAllocationId', teachingAllocationId);
        formData.append('title', title);
        formData.append('sourceType', 'text');
        formData.append('textContent', textContent.trim());
        const response = await fetch('/api/lecture-notes/ingest', { method: 'POST', body: formData });
        const json = await response.json() as { materialId?: string; chunkCount?: number; error?: string };
        if (!response.ok || !json.materialId) throw new Error(json.error ?? 'Failed.');
        onMaterialAdded({
          id: json.materialId, title, source_type: 'text',
          source_url: null, original_filename: null,
          chunk_count: json.chunkCount ?? 0, ingested_at: new Date().toISOString(), created_at: new Date().toISOString(),
        });
        setTextContent(''); setTextTitle('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed.');
      } finally { setLoading(false); }
    }
  }

  const tabs: { id: SourceTab; label: string; icon: React.ReactNode }[] = [
    { id: 'file', label: 'Files', icon: <Paperclip className="size-3.5" /> },
    { id: 'url', label: 'URL', icon: <Globe className="size-3.5" /> },
    { id: 'text', label: 'Paste text', icon: <Type className="size-3.5" /> },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-surface-subtle p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Add Source Materials</p>

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

      {/* File upload — multi-select */}
      {activeTab === 'file' && (
        <div className="space-y-2">
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border-strong bg-surface px-3 py-5 text-center transition hover:border-primary/40 hover:bg-surface-subtle"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-5 text-text-muted" />
            <p className="text-xs font-medium text-text-secondary">Click to select PDFs or DOCX files</p>
            <p className="text-[11px] text-text-muted">Multiple files supported — all will be read together</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            multiple
            className="hidden"
          />
          {/* File queue */}
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={f.name} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                  <FileText className="size-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-text-primary">{f.name}</span>
                  {loading && uploadingIndex === i && (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                  )}
                  {!loading && (
                    <button type="button" onClick={() => removeFile(f.name)} className="shrink-0 text-text-muted hover:text-danger">
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* URL */}
      {activeTab === 'url' && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      )}

      {/* Paste text */}
      {activeTab === 'text' && (
        <div className="space-y-2">
          <input
            type="text"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            placeholder="Title (optional)"
            className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Paste notes, transcripts, or any text content here…"
            rows={5}
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {error && (
        <p className="whitespace-pre-line rounded-lg bg-danger-surface px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="sm"
        disabled={loading}
        leadingIcon={loading ? <Loader2 className="size-4 animate-spin" /> : undefined}
        className="w-full"
      >
        {loading
          ? uploadingIndex !== null
            ? `Uploading ${uploadingIndex + 1} of ${files.length}…`
            : 'Processing…'
          : activeTab === 'file' && files.length > 1
            ? `Upload ${files.length} files`
            : 'Add material'}
      </Button>
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
        <p className="mt-1 text-xs text-text-muted">Add PDFs, DOCX files, URLs or paste text to enrich your notes.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {materials.map((m) => (
        <li
          key={m.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
        >
          <div className="shrink-0">{sourceIcon(m.source_type)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-text-primary">{m.title}</p>
            {m.chunk_count > 0 && (
              <p className="text-[11px] text-text-muted">{m.chunk_count} chunks indexed</p>
            )}
          </div>
          {m.ingested_at ? (
            <Badge variant="success" dot className="shrink-0 text-[10px]">Ready</Badge>
          ) : (
            <Badge variant="warning" className="shrink-0 text-[10px]">Pending</Badge>
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
