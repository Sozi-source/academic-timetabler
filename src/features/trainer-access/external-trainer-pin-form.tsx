'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, LogIn, LockKeyhole } from 'lucide-react';

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
      const result = await response.json() as { message?: string; success?: boolean };

      if (!response.ok || !result.success) {
        setMessage(result.message ?? 'Unable to sign in. Check your PIN and try again.');
        return;
      }

      router.replace('/external-trainer/units');
      router.refresh();
    } catch {
      setMessage('Unable to sign in right now. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {message ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-surface px-3.5 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{message}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="external-trainer-pin" className="sr-only">Access PIN</label>
          <span className="rounded-full border border-[#f0dfa0] bg-[#fff9df] px-2 py-0.5 text-[10px] font-semibold text-[#77621a]">8 digits</span>
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#71837e]" aria-hidden="true" />
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
            placeholder="Enter your access PIN"
            className="h-12 w-full rounded-xl border border-[#cbd9d5] bg-[#fbfdfc] pl-11 pr-3 text-base tracking-[0.3em] text-[#183b35] outline-none transition placeholder:text-sm placeholder:tracking-normal placeholder:text-[#87958f] focus:border-[#0f766e] focus:bg-white focus:ring-4 focus:ring-[#0f766e]/10 disabled:cursor-wait disabled:bg-[#f1f5f4]"
          />
        </div>
      </div>

      <button type="submit" disabled={pending || pin.length !== 8} className="flex h-10.5 w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b625b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] disabled:cursor-not-allowed disabled:bg-[#83bdb3]">
        {pending ? <LoaderCircle className="size-4 animate-spin text-[#fff2b2]" aria-hidden="true" /> : <LogIn className="size-4 text-[#fff2b2]" aria-hidden="true" />}
        {pending ? 'Verifying PIN…' : 'Continue'}
      </button>
      <p className="text-center text-xs leading-5 text-[#71817c]">
        Need a PIN? Contact your department administrator.
      </p>
    </form>
  );
}
