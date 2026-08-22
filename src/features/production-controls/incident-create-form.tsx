'use client';

import {
  AlertTriangle,
  LoaderCircle,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  DeploymentEnvironment,
  ProductionIncidentSeverity,
  ReleaseDeployment,
} from './types';

export function IncidentCreateForm({
  deployments,
}: {
  deployments: ReleaseDeployment[];
}) {
  const router = useRouter();
  const [environment, setEnvironment] = useState<DeploymentEnvironment>('pilot');
  const [deploymentId, setDeploymentId] = useState('');
  const [severity, setSeverity] = useState<ProductionIncidentSeverity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matching = deployments.filter((item) => item.environment === environment);

  async function create() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/operations/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          environment,
          deploymentId: deploymentId || null,
          severity,
          title,
          description,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.message ?? 'Incident could not be logged.');
        return;
      }

      setTitle('');
      setDescription('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-white p-4">
      <h2 className="text-sm font-bold text-text-primary">Log operational incident</h2>
      <p className="mt-0.5 text-[10px] text-text-muted">
        Pilot/Production issues only. Pre-release UAT issues remain in the Defect register.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <select
          value={environment}
          disabled={busy}
          onChange={(event) => {
            setEnvironment(event.target.value as DeploymentEnvironment);
            setDeploymentId('');
          }}
          className="h-10 rounded-lg border border-border-strong bg-white px-2.5 text-xs font-semibold text-text-secondary outline-none focus:border-primary"
        >
          <option value="pilot">Pilot</option>
          <option value="production">Production</option>
        </select>

        <select
          value={deploymentId}
          disabled={busy}
          onChange={(event) => setDeploymentId(event.target.value)}
          className="h-10 rounded-lg border border-border-strong bg-white px-2.5 text-xs font-semibold text-text-secondary outline-none focus:border-primary"
        >
          <option value="">No deployment link</option>
          {matching.map((deployment) => (
            <option key={deployment.id} value={deployment.id}>
              {deployment.versionLabel} · {deployment.status}
            </option>
          ))}
        </select>

        <select
          value={severity}
          disabled={busy}
          onChange={(event) => setSeverity(event.target.value as ProductionIncidentSeverity)}
          className="h-10 rounded-lg border border-border-strong bg-white px-2.5 text-xs font-semibold text-text-secondary outline-none focus:border-primary"
        >
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="mt-3 grid gap-3">
        <Input
          value={title}
          maxLength={180}
          placeholder="Short incident title"
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Textarea
          value={description}
          maxLength={4000}
          rows={3}
          placeholder="What happened, impact, and immediate containment."
          disabled={busy}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      {error ? <p className="mt-2 text-[10px] text-danger">{error}</p> : null}

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
              <AlertTriangle className="size-3.5" aria-hidden="true" />
            )
          }
        >
          Log incident
        </Button>
      </div>
    </section>
  );
}
