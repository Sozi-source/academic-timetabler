'use client';

import {
  LoaderCircle,
  Rocket,
  RotateCcw,
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
import type {
  DeploymentEnvironment,
  ReleaseDeployment,
} from './types';

export function DeploymentCreateForm({
  canDeployPilot,
  canDeployProduction,
}: {
  canDeployPilot: boolean;
  canDeployProduction: boolean;
}) {
  const router = useRouter();
  const [environment, setEnvironment] = useState<DeploymentEnvironment>('pilot');
  const [versionLabel, setVersionLabel] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/testing/deployments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          environment,
          versionLabel,
          note,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.message ?? 'Deployment evidence could not be recorded.');
        return;
      }

      setVersionLabel('');
      setNote('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-white p-4">
      <div>
        <h2 className="text-sm font-bold text-text-primary">Record deployment</h2>
        <p className="mt-0.5 text-[10px] text-text-muted">
          Evidence only. Hosting deployment remains outside Academic Planner.
        </p>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[10rem_minmax(0,1fr)]">
        <select
          value={environment}
          disabled={busy}
          onChange={(event) => setEnvironment(event.target.value as DeploymentEnvironment)}
          className="h-10 rounded-lg border border-border-strong bg-white px-2.5 text-xs font-semibold text-text-secondary outline-none focus:border-primary"
        >
          <option value="pilot" disabled={!canDeployPilot}>Pilot</option>
          <option value="production" disabled={!canDeployProduction}>Production</option>
        </select>

        <Input
          value={versionLabel}
          maxLength={80}
          placeholder="Version / build label"
          disabled={busy}
          onChange={(event) => setVersionLabel(event.target.value)}
        />
      </div>

      <div className="mt-3">
        <Textarea
          value={note}
          maxLength={2000}
          rows={2}
          placeholder="Optional deployment note"
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {!canDeployPilot ? (
        <p className="mt-2 text-[10px] text-text-muted">
          Pilot requires a Passed UAT run and a release candidate currently eligible for sign-off.
        </p>
      ) : !canDeployProduction ? (
        <p className="mt-2 text-[10px] text-text-muted">
          Production requires a valid go-live sign-off and no Critical/High operational incidents.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-[10px] text-danger">{error}</p> : null}

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={
            busy ||
            versionLabel.trim().length < 3 ||
            (environment === 'pilot' && !canDeployPilot) ||
            (environment === 'production' && !canDeployProduction)
          }
          onClick={() => void record()}
          leadingIcon={
            busy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Rocket className="size-3.5" aria-hidden="true" />
            )
          }
        >
          Record deployment
        </Button>
      </div>
    </section>
  );
}

export function DeploymentRollbackAction({
  deployment,
}: {
  deployment: ReleaseDeployment;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (deployment.status !== 'deployed') return null;

  async function rollback() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/testing/deployments/${deployment.id}/rollback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.message ?? 'Rollback evidence could not be recorded.');
        return;
      }

      setReason('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label>
        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-text-muted">
          Rollback reason
        </span>
        <Input
          value={reason}
          maxLength={2000}
          disabled={busy}
          placeholder="Required only when recording a rollback"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>

      <Button
        type="button"
        size="sm"
        variant="danger"
        disabled={busy || !reason.trim()}
        onClick={() => void rollback()}
        leadingIcon={
          busy ? (
            <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="size-3" aria-hidden="true" />
          )
        }
      >
        Record rollback
      </Button>

      {error ? <p className="text-[10px] text-danger sm:col-span-2">{error}</p> : null}
    </div>
  );
}
