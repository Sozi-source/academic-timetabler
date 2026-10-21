'use client';

import { Ban, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
    let isCurrent = true;
    async function loadInitialData() {
      try {
        const response = await fetch(`/api/assessment/markbooks/${assessmentId}/trainer-invites`, { cache: 'no-store' });
        const result = await response.json() as { invites?: TrainerInvite[]; reviewMarks?: TrainerReviewMark[]; message?: string };
        if (!response.ok) throw new Error(result.message ?? 'Could not load trainer marks.');
        if (isCurrent) {
          setInvites(result.invites ?? []);
          setReviewMarks(result.reviewMarks ?? []);
        }
      } catch (cause) {
        if (isCurrent) setError(cause instanceof Error ? cause.message : 'Could not load trainer marks.');
      } finally {
        if (isCurrent) setLoading(false);
      }
    }

    void loadInitialData();
    return () => { isCurrent = false; };
  }, [assessmentId]);

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
    <section className="space-y-4">
      {message ? <p role="status" className="text-xs font-medium text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="text-xs font-medium text-red-700">{error}</p> : null}

      {invites.length > 0 ? <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold text-slate-800">Older individual trainer links</h3>
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
      </div> : null}

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h3 className="text-xs font-semibold text-slate-800">Trainer marks for HOD review</h3>
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
