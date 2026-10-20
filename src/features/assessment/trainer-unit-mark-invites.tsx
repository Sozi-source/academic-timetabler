'use client';

import { Ban, Check, Clipboard, Link2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';

interface UnitTrainerInvite {
  id: string;
  trainer_name: string;
  trainer_email: string | null;
  created_at: string;
  expires_at: string;
  last_accessed_at: string | null;
  submitted_at: string | null;
  revoked_at: string | null;
  status: 'active' | 'submitted' | 'revoked' | 'expired';
  cohortCount: number;
  submittedCohortCount: number;
}

export function TrainerUnitMarkInvites({ unitId, unitName, periodId }: { unitId: string; unitName: string; periodId: string }) {
  const endpoint = `/api/assessment/units/${unitId}/trainer-invites?periodId=${encodeURIComponent(periodId)}`;
  const [invites, setInvites] = useState<UnitTrainerInvite[]>([]);
  const [trainerName, setTrainerName] = useState('');
  const [trainerEmail, setTrainerEmail] = useState('');
  const [expiryDays, setExpiryDays] = useState('7');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadInvites = useCallback(async () => {
    const response = await fetch(endpoint, { cache: 'no-store' });
    const result = await response.json() as { invites?: UnitTrainerInvite[]; message?: string };
    if (!response.ok) throw new Error(result.message ?? 'Could not load trainer links.');
    setInvites(result.invites ?? []);
  }, [endpoint]);

  useEffect(() => {
    void loadInvites()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load trainer links.'))
      .finally(() => setLoading(false));
  }, [loadInvites]);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    setInviteUrl(null);
    setCopied(false);
    setShowFallback(false);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ periodId, trainerName, trainerEmail, expiryDays: Number(expiryDays) }),
      });
      const result = await response.json() as { inviteUrl?: string; message?: string };
      if (!response.ok || !result.inviteUrl) throw new Error(result.message ?? 'Could not create the trainer link.');
      setInviteUrl(result.inviteUrl);
      setTrainerName('');
      setTrainerEmail('');
      setMessage('One unit link created. The trainer can select and submit each cohort separately.');
      await loadInvites();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the trainer link.');
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setShowFallback(true);
      setError('Could not copy automatically. Select and copy the link shown below.');
    }
  }

  async function revokeInvite(inviteId: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/assessment/trainer-invites/${inviteId}`, { method: 'DELETE' });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'Could not revoke the link.');
      setMessage('Unit trainer link revoked.');
      await loadInvites();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not revoke the link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-sky-700"><ShieldCheck className="size-5" /></span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">One trainer link for this unit</h2>
          <p className="mt-0.5 text-xs text-slate-600">The trainer can switch between all available cohorts and submit each cohort separately.</p>
        </div>
      </div>

      <form onSubmit={createInvite} className="grid gap-2 sm:grid-cols-[1fr_1fr_110px_auto]">
        <input required minLength={2} maxLength={120} value={trainerName} onChange={(event) => setTrainerName(event.target.value)} placeholder="Trainer name" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs" />
        <input type="email" value={trainerEmail} onChange={(event) => setTrainerEmail(event.target.value)} placeholder="Email (optional)" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs" />
        <select value={expiryDays} onChange={(event) => setExpiryDays(event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs">
          <option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option>
        </select>
        <Button type="submit" disabled={busy || !trainerName.trim()}><Link2 className="size-4" />{busy ? 'Working...' : 'Create link'}</Button>
      </form>

      {inviteUrl ? (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a href={inviteUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-900 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-700">{unitName}</a>
            <Button type="button" size="sm" variant="outline" onClick={copyInvite}>{copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}{copied ? 'Copied' : 'Copy link'}</Button>
          </div>
          {showFallback ? <input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700" aria-label="Unit trainer invitation link" /> : null}
        </div>
      ) : null}
      {message ? <p role="status" className="text-xs font-medium text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="text-xs font-medium text-red-700">{error}</p> : null}

      <div className="space-y-2 border-t border-sky-100 pt-3">
        <h3 className="text-xs font-semibold text-slate-800">Unit trainer links</h3>
        {loading ? <p className="text-xs text-slate-500">Loading links...</p> : invites.length === 0 ? <p className="text-xs text-slate-500">No trainer links yet.</p> : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{invite.trainer_name}{invite.trainer_email ? ` · ${invite.trainer_email}` : ''}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Expires {new Date(invite.expires_at).toLocaleString()} · {invite.status} · {invite.submittedCohortCount}/{invite.cohortCount} cohorts submitted
                    {invite.last_accessed_at ? ` · Opened ${new Date(invite.last_accessed_at).toLocaleString()}` : ''}
                  </p>
                </div>
                {invite.status === 'active' ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void revokeInvite(invite.id)}><Ban className="size-3.5" />Revoke</Button> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
