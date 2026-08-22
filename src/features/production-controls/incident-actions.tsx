'use client';

import {
  LoaderCircle,
  Save,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  allowedIncidentStatuses,
  incidentNeedsResolutionNote,
  incidentStatusLabel,
} from './domain';
import type {
  ProductionIncident,
  ProductionIncidentStatus,
} from './types';

export function IncidentActions({
  incident,
}: {
  incident: ProductionIncident;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ProductionIncidentStatus>(incident.status);
  const [note, setNote] = useState(incident.resolutionNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsNote = incidentNeedsResolutionNote(status);

  async function save() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/operations/incidents/${incident.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          resolutionNote: note,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.message ?? 'Incident could not be updated.');
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 lg:grid-cols-[9rem_minmax(10rem,1fr)_auto] lg:items-end">
      <label>
        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-text-muted">
          Status
        </span>
        <select
          value={status}
          disabled={busy}
          onChange={(event) => setStatus(event.target.value as ProductionIncidentStatus)}
          className="h-9 w-full rounded-lg border border-border-strong bg-white px-2 text-[11px] font-semibold text-text-secondary outline-none focus:border-primary"
        >
          {allowedIncidentStatuses(incident.status).map((value) => (
            <option key={value} value={value}>{incidentStatusLabel(value)}</option>
          ))}
        </select>
      </label>

      <label>
        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-text-muted">
          Resolution note{needsNote ? ' · Required' : ''}
        </span>
        <Input
          value={note}
          maxLength={4000}
          disabled={busy}
          placeholder="Required for Resolved / Closed"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || (needsNote && !note.trim())}
        onClick={() => void save()}
        leadingIcon={
          busy ? (
            <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-3" aria-hidden="true" />
          )
        }
      >
        Save
      </Button>

      {error ? <p className="text-[10px] text-danger lg:col-span-3">{error}</p> : null}
    </div>
  );
}
