'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, LogIn, LockKeyhole } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

export function ExternalTrainerPinForm() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch('/api/external-trainer/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const result = await response.json() as { message?: string; tokenHash?: string };

      if (!response.ok || !result.tokenHash) {
        setMessage(result.message ?? 'Unable to sign in. Check your PIN and try again.');
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: 'magiclink',
      });

      if (error) {
        setMessage('Unable to sign in. Ask the department to generate a new PIN.');
        return;
      }

      router.replace('/external-trainer');
      router.refresh();
    } catch {
      setMessage('Unable to sign in right now. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      {message ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-xs text-danger">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p>{message}</p>
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="external-trainer-pin" className="block text-xs font-semibold text-text-primary">Access PIN</label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            id="external-trainer-pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{8}"
            maxLength={8}
            minLength={8}
            required
            disabled={pending}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="8-digit PIN"
            className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm tracking-[0.2em] text-text-primary outline-none transition placeholder:text-text-muted placeholder:tracking-normal focus:border-focus-border focus:ring-2 focus:ring-focus-ring/25 disabled:bg-surface-muted"
          />
        </div>
      </div>

      <button type="submit" disabled={pending || pin.length !== 8} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <LogIn className="size-3.5" aria-hidden="true" />}
        {pending ? 'Signing in...' : 'Sign in'}
      </button>
      <p className="text-center text-[11px] text-text-muted">Ask your department contact to generate or replace your PIN.</p>
    </form>
  );
}
