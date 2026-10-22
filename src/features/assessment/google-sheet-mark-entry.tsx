'use client';

import { ExternalLink, RefreshCw, Sheet } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

export function GoogleSheetMarkEntry({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [connectionLoaded, setConnectionLoaded] = useState(false);
  const [busy, setBusy] = useState<'create' | 'sync' | null>(null);
  const [message, setMessage] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('googleConnection') === 'connected' ? 'College Google account connected.' : '';
    }
    return '';
  });
  const [error, setError] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('googleConnection') === 'error' ? 'Google account connection did not complete. Please try again.' : '';
    }
    return '';
  });

  useEffect(() => {
    void fetch('/api/assessment/google-auth/status', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json() as { connected?: boolean; email?: string | null };
        if (response.ok && result.connected && result.email) setGoogleEmail(result.email);
      })
      .catch(() => setError('Could not check the college Google account connection.'))
      .finally(() => setConnectionLoaded(true));

    const params = new URLSearchParams(window.location.search);
    if (params.has('googleConnection')) window.history.replaceState({}, '', pathname);
  }, [pathname]);

  async function post(path: string, payload: Record<string, string>) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as { message?: string; url?: string; savedCount?: number };
    if (!response.ok) throw new Error(result.message ?? 'Request failed.');
    return result;
  }

  async function createSheet() {
    setBusy('create'); setError(''); setMessage('');
    try {
      const result = await post(`/api/assessment/markbooks/${assessmentId}/google-sheet`, { trainerEmail: email });
      if (result.url) setUrl(result.url);
      setMessage('Private mark sheet created and shared with the trainer.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the sheet.');
    } finally { setBusy(null); }
  }

  async function syncSheet() {
    setBusy('sync'); setError(''); setMessage('');
    try {
      const result = await post(`/api/assessment/markbooks/${assessmentId}/google-sheet/sync`, { url });
      setMessage(`${result.savedCount ?? 0} students synced to draft marks. Review them in the markbook before finalizing.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sync marks.');
    } finally { setBusy(null); }
  }

  return (
    <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700"><Sheet className="size-5" /></span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Trainer Google Sheet</h2>
          <p className="mt-0.5 text-xs text-slate-600">Create a private roster sheet and share it with a trainer. Sync imports validated marks as drafts; review them before finalizing.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {googleEmail ? (
          <p className="font-medium text-emerald-800">Connected to {googleEmail}</p>
        ) : (
          <p className="text-slate-600">Connect the college Google account to create sheets in its Drive.</p>
        )}
        <Link
          href={`/api/assessment/google-auth/start?returnTo=${encodeURIComponent(`/assessment/marks/${assessmentId}`)}`}
          className="font-semibold text-primary underline"
        >
          {googleEmail ? 'Switch Google account' : 'Connect college Google account'}
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Trainer Google account email" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs" />
        <Button type="button" variant="outline" disabled={!connectionLoaded || !googleEmail || !email || busy !== null} onClick={createSheet}>
          <Sheet className="size-4" />{busy === 'create' ? 'Creating...' : 'Create and share sheet'}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste the trainer's Google Sheets URL" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs" />
        <Button type="button" disabled={!connectionLoaded || !googleEmail || !url || busy !== null} onClick={syncSheet}>
          <RefreshCw className={`size-4 ${busy === 'sync' ? 'animate-spin' : ''}`} />{busy === 'sync' ? 'Syncing...' : 'Sync marks'}
        </Button>
      </div>
      {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline">Open sheet <ExternalLink className="size-3" /></a> : null}
      {message ? <p role="status" className="text-xs font-medium text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="text-xs font-medium text-red-700">{error}</p> : null}
    </section>
  );
}
