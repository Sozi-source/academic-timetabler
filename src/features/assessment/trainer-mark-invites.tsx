'use client';

import { Ban, Check, Clipboard, Link2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';

interface TrainerInvite {
  id: string;
  trainer_name: string;
  trainer_email: string | null;
  created_at: string;
  expires_at: string;
  last_accessed_at: string | null;
  submitted_at: string | null;
  revoked_at: string | null;
  status: 'active' | 'submitted' | 'revoked' | 'expired';
}

interface TrainerReviewMark {
  student_id: string;
  assignment_mark: number | null;
  presentation_mark: number | null;
  rat_mark: number | null;
  cat_mark: number | null;
  exam_mark: number | null;
  updated_at: string;
  student: { admission_number: string | null; full_name: string | null } | null;
  trainer: { trainer_name: string; submitted_at: string | null } | null;
}

export function TrainerMarkInvites({ assessmentId }: { assessmentId: string }) {
  const [invites, setInvites] = useState<TrainerInvite[]>([]);
  const [reviewMarks, setReviewMarks] = useState<TrainerReviewMark[]>([]);
  const [trainerName, setTrainerName] = useState('');
  const [trainerEmail, setTrainerEmail] = useState('');
  const [expiryDays, setExpiryDays] = useState('7');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadInvites = useCallback(async () => {
    const response = await fetch(`/api/assessment/markbooks/${assessmentId}/trainer-invites`, { cache: 'no-store' });
    const result = await response.json() as { invites?: TrainerInvite[]; reviewMarks?: TrainerReviewMark[]; message?: string };
    if (!response.ok) throw new Error(result.message ?? 'Could not load trainer links.');
    setInvites(result.invites ?? []);
    setReviewMarks(result.reviewMarks ?? []);
  }, [assessmentId]);

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
    try {
      const response = await fetch(`/api/assessment/markbooks/${assessmentId}/trainer-invites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trainerName, trainerEmail, expiryDays: Number(expiryDays) }),
      });
      const result = await response.json() as { inviteUrl?: string; message?: string };
      if (!response.ok || !result.inviteUrl) throw new Error(result.message ?? 'Could not create the trainer link.');
      setInviteUrl(result.inviteUrl);
      setTrainerName('');
      setTrainerEmail('');
      setMessage('Trainer link created. Copy it and send it to the trainer privately.');
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
      setError('Could not copy automatically. Select and copy the link shown below.');
    }
  }

  async function revokeInvite(inviteId: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/assessment/trainer-invites/${inviteId}`, { method: 'DELETE' });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'Could not revoke the link.');
      setMessage('Trainer link revoked.');
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
          <h2 className="text-sm font-semibold text-slate-900">External trainer access</h2>
          <p className="mt-0.5 text-xs text-slate-600">Create a private, expiring link for this markbook. Trainers need no Academic Planner account.</p>
        </div>
      </div>

      <form onSubmit={createInvite} className="grid gap-2 sm:grid-cols-[1fr_1fr_110px_auto]">
        <input
          required
          minLength={2}
          maxLength={120}
          value={trainerName}
          onChange={(event) => setTrainerName(event.target.value)}
          placeholder="Trainer name"
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs"
        />
        <input
          type="email"
          value={trainerEmail}
          onChange={(event) => setTrainerEmail(event.target.value)}
          placeholder="Email (optional)"
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs"
        />
        <select value={expiryDays} onChange={(event) => setExpiryDays(event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs">
          <option value="1">1 day</option>
          <option value="3">3 days</option>
          <option value="7">7 days</option>
          <option value="14">14 days</option>
        </select>
        <Button type="submit" disabled={busy || !trainerName.trim()}>
          <Link2 className="size-4" />{busy ? 'Working...' : 'Create link'}
        </Button>
      </form>

      <p className="text-[11px] text-slate-500">Anyone with the link can enter marks for this roster until it expires or you revoke it. Share it privately.</p>

      {inviteUrl ? (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-900">Copy this link now. It is shown only once.</p>
            <Button type="button" size="sm" variant="outline" onClick={copyInvite}>
              {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700" aria-label="Trainer invitation link" />
        </div>
      ) : null}

      {message ? <p role="status" className="text-xs font-medium text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="text-xs font-medium text-red-700">{error}</p> : null}

      <div className="space-y-2 border-t border-sky-100 pt-3">
        <h3 className="text-xs font-semibold text-slate-800">Trainer links</h3>
        {loading ? <p className="text-xs text-slate-500">Loading links...</p> : invites.length === 0 ? <p className="text-xs text-slate-500">No trainer links yet.</p> : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900">{invite.trainer_name}{invite.trainer_email ? ` · ${invite.trainer_email}` : ''}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Expires {new Date(invite.expires_at).toLocaleString()} · {invite.status === 'submitted' ? `Submitted ${new Date(invite.submitted_at ?? '').toLocaleString()}` : invite.status}
                    {invite.last_accessed_at ? ` · Opened ${new Date(invite.last_accessed_at).toLocaleString()}` : ''}
                  </p>
                </div>
                {invite.status === 'active' ? (
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void revokeInvite(invite.id)}>
                    <Ban className="size-3.5" />Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-sky-100 pt-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-800">Trainer marks for HOD review</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">These are unfinalized drafts. Review them here, then use the existing markbook workflow to make any corrections and finalize results.</p>
        </div>
        {loading ? <p className="text-xs text-slate-500">Loading trainer marks...</p> : reviewMarks.length === 0 ? <p className="text-xs text-slate-500">No trainer marks have been saved yet.</p> : (
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[850px] text-left text-[11px]">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Admission No.</th>
                  <th className="px-3 py-2">Trainer</th>
                  <th className="px-3 py-2 text-center">Assignment /5</th>
                  <th className="px-3 py-2 text-center">Presentation /10</th>
                  <th className="px-3 py-2 text-center">RAT /15</th>
                  <th className="px-3 py-2 text-center">CAT /15</th>
                  <th className="px-3 py-2 text-center">Exam /70</th>
                  <th className="px-3 py-2">Review status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviewMarks.map((mark) => (
                  <tr key={mark.student_id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{mark.student?.full_name ?? 'Unknown student'}</td>
                    <td className="px-3 py-2 text-slate-600">{mark.student?.admission_number ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{mark.trainer?.trainer_name ?? 'Trainer'}</td>
                    {[mark.assignment_mark, mark.presentation_mark, mark.rat_mark, mark.cat_mark, mark.exam_mark].map((value, index) => (
                      <td key={index} className="px-3 py-2 text-center font-semibold text-slate-800">{value ?? '—'}</td>
                    ))}
                    <td className="px-3 py-2">
                      {mark.trainer?.submitted_at ? <span className="font-semibold text-emerald-700">Submitted</span> : <span className="text-amber-700">Draft</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
