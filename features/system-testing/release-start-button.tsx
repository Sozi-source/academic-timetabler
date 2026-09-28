'use client';

import { FlaskConical, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function ReleaseStartButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/testing/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Release test run could not be started.');
        return;
      }

      router.push(`/testing/runs/${payload.runId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        size="sm"
        disabled={disabled || busy}
        onClick={() => void start()}
        leadingIcon={
          busy ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FlaskConical className="size-3.5" aria-hidden="true" />
          )
        }
      >
        Start UAT run
      </Button>

      {error ? <p className="max-w-xs text-[10px] leading-4 text-danger">{error}</p> : null}
    </div>
  );
}
