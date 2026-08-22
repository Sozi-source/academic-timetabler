'use client';

import {
  LoaderCircle,
  ShieldCheck,
  ShieldX,
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
  ReleaseGoLiveStatus,
} from './release-controls-types';

export function ReleaseSignoffActions({
  status,
}: {
  status: ReleaseGoLiveStatus;
}) {
  const router = useRouter();
  const [verificationRef, setVerificationRef] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'revoke' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy('approve');
    setError(null);

    try {
      const response = await fetch('/api/testing/sign-off', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verificationRef,
          note,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Release could not be signed off.');
        return;
      }

      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!status.activeSignoff) return;

    setBusy('revoke');
    setError(null);

    try {
      const response = await fetch(
        `/api/testing/sign-off/${status.activeSignoff.id}/revoke`,
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
        setError(payload?.message ?? 'Sign-off could not be revoked.');
        return;
      }

      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (status.activeSignoff) {
    return (
      <section
        className={
          status.signoffValid
            ? 'rounded-xl border border-success-border bg-success-surface px-4 py-4'
            : 'rounded-xl border border-danger-border bg-danger-surface px-4 py-4'
        }
      >
        <div className={status.signoffValid ? 'flex items-center gap-2 text-success' : 'flex items-center gap-2 text-danger'}>
          {status.signoffValid ? (
            <ShieldCheck className="size-4" aria-hidden="true" />
          ) : (
            <ShieldX className="size-4" aria-hidden="true" />
          )}
          <p className="text-sm font-bold">
            {status.signoffValid ? 'Go-live approved' : 'Sign-off is stale'}
          </p>
        </div>

        <p className="mt-2 text-[11px] text-text-secondary">
          Verification: {status.activeSignoff.verificationRef}
        </p>
        {!status.signoffValid ? (
          <p className="mt-1 text-[10px] text-danger">
            Current release gates changed after approval. Revoke this sign-off, resolve blockers and complete a fresh approval.
          </p>
        ) : null}

        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <Input
            value={reason}
            maxLength={2000}
            placeholder="Reason to revoke this approval"
            disabled={busy !== null}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={busy !== null || reason.trim().length < 3}
            onClick={() => void revoke()}
            leadingIcon={
              busy === 'revoke' ? (
                <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldX className="size-3" aria-hidden="true" />
              )
            }
          >
            Revoke sign-off
          </Button>
        </div>

        {error ? <p className="mt-2 text-[10px] text-danger">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-4">
      <h2 className="text-sm font-bold text-text-primary">Approve go-live</h2>
      <p className="mt-1 text-[10px] leading-4 text-text-muted">
        Run scripts\\VERIFY_RELEASE_CANDIDATE.ps1 first, then enter the verification ID it prints.
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label>
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-text-muted">
            Verification ID
          </span>
          <Input
            value={verificationRef}
            maxLength={200}
            placeholder="RC-..."
            disabled={busy !== null || !status.eligible}
            onChange={(event) => setVerificationRef(event.target.value)}
          />
        </label>

        <label>
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-text-muted">
            Sign-off note
          </span>
          <Textarea
            rows={2}
            maxLength={2000}
            value={note}
            placeholder="Optional"
            disabled={busy !== null || !status.eligible}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>

      {error ? <p className="mt-2 text-[10px] text-danger">{error}</p> : null}

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={
            busy !== null ||
            !status.eligible ||
            verificationRef.trim().length < 8
          }
          onClick={() => void approve()}
          leadingIcon={
            busy === 'approve' ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-3.5" aria-hidden="true" />
            )
          }
        >
          Approve go-live
        </Button>
      </div>
    </section>
  );
}
