'use client';

import {
  Bug,
  LoaderCircle,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  useState,
} from 'react';

import {
  Button,
} from '@/components/ui/button';
import {
  Input,
} from '@/components/ui/input';
import {
  Textarea,
} from '@/components/ui/textarea';

export function ReleaseDefectCreateForm({
  runId,
  caseKey,
}: {
  runId: string | null;
  caseKey: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/testing/defects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          severity,
          runId,
          caseKey,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Defect could not be logged.');
        return;
      }

      setTitle('');
      setDescription('');
      setSeverity('medium');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Log defect</h2>
          {caseKey ? (
            <p className="mt-0.5 text-[10px] text-text-muted">
              Linked to {caseKey}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem]">
        <Input
          value={title}
          maxLength={180}
          placeholder="Short defect title"
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />

        <select
          value={severity}
          disabled={busy}
          onChange={(event) => setSeverity(event.target.value)}
          className="h-10 rounded-lg border border-border-strong bg-white px-2.5 text-xs font-semibold text-text-secondary outline-none focus:border-primary"
        >
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="mt-3">
        <Textarea
          value={description}
          maxLength={4000}
          rows={3}
          placeholder="What failed, where it happened, and what was expected."
          disabled={busy}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      {error ? (
        <p className="mt-2 text-[10px] text-danger">{error}</p>
      ) : null}

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={busy || title.trim().length < 3 || description.trim().length < 3}
          onClick={() => void create()}
          leadingIcon={
            busy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Bug className="size-3.5" aria-hidden="true" />
            )
          }
        >
          Log defect
        </Button>
      </div>
    </section>
  );
}
