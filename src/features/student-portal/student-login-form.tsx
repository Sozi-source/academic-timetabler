'use client';

import { KeyRound, LoaderCircle, LogIn, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { studentPortalLogin, type StudentLoginState } from './actions';

const initialState: StudentLoginState = {
  error: null,
};

export function StudentLoginForm() {
  const [state, action, pending] = useActionState(studentPortalLogin, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-text-primary" htmlFor="admissionNumber">
          Full Admission Number
        </label>
        <Input
          id="admissionNumber"
          name="admissionNumber"
          autoComplete="username"
          required
          placeholder="e.g. CND/2026/042"
          className="h-10 rounded-lg text-xs"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold text-text-primary" htmlFor="pin">
          Preferred PIN / Password
        </label>
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            id="pin"
            name="pin"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Enter your PIN or password"
            className="h-10 rounded-lg pl-9 text-xs"
          />
        </div>
      </div>

      {state.error && (
        <p className="text-[11px] font-semibold text-danger">
          {state.error}
        </p>
      )}

      <Button
        className="h-10 w-full rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-hover transition"
        type="submit"
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <LogIn className="size-3.5" aria-hidden="true" />
        )}
        {pending ? 'Signing in...' : 'Sign in'}
      </Button>

      <div className="pt-2 text-center border-t border-border">
        <Link
          href="/student/activate"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-deep transition"
        >
          <UserCheck className="size-3.5" />
          First time here? Activate account & set PIN
        </Link>
      </div>
    </form>
  );
}
