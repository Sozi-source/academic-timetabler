'use client';

import { useRef, useState } from 'react';
import { FileArchive, FileText, Globe, Loader2, Paperclip, Trash2, Type, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client';

interface Material {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  original_filename: string | null;
  chunk_count: number;
  ingested_at: string | null;
  processing_error?: string | null;
  created_at: string;
}

interface MaterialUploadFormProps {
  unitId: string;
  teachingAllocationId?: string | null;
  onMaterialAdded: (material: Material) => void;
}

type SourceTab = 'file' | 'url' | 'text';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_BYTES = 50 * 1024 * 1024;

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
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...selected.filter((f) => !existing.has(f.name))];
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function uploadFile(file: File): Promise<void> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const sourceType = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : ext === 'pptx' ? 'pptx' : ext === 'zip' ? 'zip' : null;
    if (!sourceType) {
      throw new Error(`${file.name}: only PDF, DOCX, PPTX and ZIP files are supported.`);
    }

    const maxBytes = sourceType === 'zip' ? MAX_ZIP_BYTES : MAX_FILE_BYTES;
    if (file.size > maxBytes) {
      throw new Error(`${file.name} is larger than ${sourceType === 'zip' ? '50 MB' : '25 MB'}.`);
    }

    // 1. Ask the app for a signed Storage upload target.
    // The file itself does not pass through Vercel.
    const prepareResponse = await fetch('/api/lecture-notes/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId,
        teachingAllocationId: teachingAllocationId ?? null,
        title: file.name.replace(/\.[^.]+$/, ''),
        sourceType,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      }),
    });

    const prepared = await prepareResponse.json() as {
      materialId?: string;
      path?: string;
      token?: string;
      material?: Material;
      error?: string;
    };

    if (!prepareResponse.ok || !prepared.materialId || !prepared.path || !prepared.token || !prepared.material) {
      throw new Error(prepared.error ?? 'Could not prepare the upload.');
    }

    const supabase = createBrowserSupabaseClient();
    const contentType = file.type || (sourceType === 'zip' ? 'application/zip' : undefined);
    const { error: uploadError } = await supabase.storage
      .from('lecture-notes')
      .uploadToSignedUrl(prepared.path, prepared.token, file, {
        contentType,
      });

    if (uploadError) {
      await fetch(`/api/lecture-notes/materials?materialId=${prepared.materialId}`, { method: 'DELETE' }).catch(() => undefined);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // 2. Start processing after the Storage upload completes.
    // The endpoint returns 202; parsing and embeddings continue in the background.
    const processResponse = await fetch('/api/lecture-notes/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialId: prepared.materialId }),
    });

    const processJson = await processResponse.json() as { error?: string };
    if (!processResponse.ok && processResponse.status !== 202) {
      await fetch(`/api/lecture-notes/materials?materialId=${prepared.materialId}`, { method: 'DELETE' }).catch(() => undefined);
      throw new Error(processJson.error ?? 'Could not start material processing.');
    }

    onMaterialAdded({
      ...prepared.material,
      ingested_at: null,
      chunk_count: 0,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (activeTab === 'file') {
      if (files.length === 0) {
        setError('Select at least one file.');
        return;
      }

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
      if (!url.trim()) {
        setError('Enter a URL.');
        return;
      }

      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('unitId', unitId);
        if (teachingAllocationId) formData.append('teachingAllocationId', teachingAllocationId);
        formData.append('title', url.trim());
        formData.append('sourceType', 'url');
        formData.append('sourceUrl', url.trim());

        const response = await fetch('/api/lecture-notes/ingest', { method: 'POST', body: formData });
        const json = await response.json() as { material?: Material; error?: string };

        if (!response.ok || !json.material) {
          throw new Error(json.error ?? 'Could not add source.');
        }

        onMaterialAdded(json.material);
        setUrl('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not add source.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!textContent.trim()) {
      setError('Paste some text first.');
      return;
    }

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
      const json = await response.json() as { material?: Material; error?: string };

      if (!response.ok || !json.material) {
        throw new Error(json.error ?? 'Could not add source.');
      }

      onMaterialAdded(json.material);
      setTextContent('');
      setTextTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add source.');
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: SourceTab; label: string; icon: React.ReactNode }[] = [
    { id: 'file', label: 'Files', icon: <Paperclip className="size-3.5" /> },
    { id: 'url', label: 'URL', icon: <Globe className="size-3.5" /> },
    { id: 'text', label: 'Text', icon: <Type className="size-3.5" /> },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Source materials</p>
        <span className="text-[10px] text-text-muted">PDF / DOCX / PPTX · 25 MB · ZIP archive · 50 MB</span>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-surface-subtle p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-text-secondary hover:bg-surface'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'file' && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong bg-surface-subtle px-3 py-5 text-center transition hover:border-primary/50 hover:bg-primary/[0.03]"
          >
            <FileArchive className="size-5 text-text-muted" />
            <span className="text-xs font-medium text-text-secondary">Select lecture files or a ZIP archive</span>
            <span className="text-[11px] text-text-muted">PDF, DOCX, PPTX slides, or ZIP archives</span>
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.pptx,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-zip-compressed"
            onChange={handleFileChange}
            multiple
            className="hidden"
          />

          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                  <FileText className="size-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-text-primary">{file.name}</span>
                  <span className="shrink-0 text-[10px] text-text-muted">{Math.ceil(file.size / 1024 / 1024)} MB</span>
                  {loading && uploadingIndex === index ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                  ) : !loading ? (
                    <button type="button" onClick={() => removeFile(file.name)} className="shrink-0 text-text-muted hover:text-danger">
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'url' && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      )}

      {activeTab === 'text' && (
        <div className="space-y-2">
          <input
            type="text"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            placeholder="Title"
            className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Paste notes or teaching text…"
            rows={5}
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {error ? (
        <p className="whitespace-pre-line rounded-lg border border-danger-border bg-danger-surface px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

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
            : 'Adding…'
          : activeTab === 'file' && files.length > 1
            ? `Add ${files.length} files`
            : 'Add source'}
      </Button>
    </form>
  );
}

function sourceIcon(type: string) {
  switch (type) {
    case 'pdf':
      return <FileText className="size-4 text-danger" />;
    case 'docx':
      return <FileText className="size-4 text-primary" />;
    case 'pptx':
      return <FileText className="size-4 text-amber-500" />;
    case 'zip':
      return <FileArchive className="size-4 text-primary" />;
    case 'url':
      return <Globe className="size-4 text-text-muted" />;
    default:
      return <Type className="size-4 text-text-muted" />;
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
      const response = await fetch(`/api/lecture-notes/materials?materialId=${id}`, { method: 'DELETE' });
      if (response.ok) onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  if (materials.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
        <FileText className="mx-auto size-8 text-text-subtle" />
        <p className="mt-2 text-sm font-medium text-text-secondary">No source materials</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {materials.map((m) => (
        <li key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
          <div className="shrink-0">{sourceIcon(m.source_type)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-text-primary">{m.title}</p>
            {m.processing_error ? (
              <p className="text-[11px] font-medium text-danger break-words" title={m.processing_error}>
                {m.processing_error}
              </p>
            ) : m.ingested_at ? (
              <p className="text-[11px] text-text-muted">{m.chunk_count} indexed chunks</p>
            ) : (
              <p className="text-[11px] text-text-muted">Processing in background…</p>
            )}
          </div>

          {m.processing_error ? (
            <Badge variant="danger" className="shrink-0 text-[10px]">Failed</Badge>
          ) : m.ingested_at ? (
            <Badge variant="success" dot className="shrink-0 text-[10px]">Ready</Badge>
          ) : (
            <Badge variant="warning" className="shrink-0 text-[10px]">Processing</Badge>
          )}

          <button
            type="button"
            onClick={() => handleDelete(m.id)}
            disabled={deletingId === m.id}
            className="shrink-0 rounded-lg p-1.5 text-text-muted transition hover:bg-danger-surface hover:text-danger"
            aria-label={`Delete ${m.title}`}
          >
            {deletingId === m.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
