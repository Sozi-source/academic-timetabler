'use client';

import {
  KeyRound,
  LoaderCircle,
  LogIn,
} from 'lucide-react';
import {
  useActionState,
} from 'react';

import {
  Button,
} from '@/components/ui/button';
import {
  Input,
} from '@/components/ui/input';

import {
  studentPortalLogin,
  type StudentLoginState,
} from './actions';

const initialState:
StudentLoginState = {
  error:
    null,
};

export function StudentLoginForm() {
  const [
    state,
    action,
    pending,
  ] =
    useActionState(
      studentPortalLogin,
      initialState,
    );

  return (
    <form
      action={action}
      className="space-y-3.5"
    >
      <div className="space-y-1">
        <label
          className="block text-xs font-semibold text-text-primary"
          htmlFor="admissionNumber"
        >
          Admission number
        </label>

        <Input
          id="admissionNumber"
          name="admissionNumber"
          autoComplete="username"
          required
          placeholder="e.g. ADM-2026-001"
          className="h-10 rounded-lg text-xs"
        />
      </div>

      <div className="space-y-1">
        <label
          className="block text-xs font-semibold text-text-primary"
          htmlFor="pin"
        >
          Access PIN
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
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            required
            placeholder="6-digit PIN"
            className="h-10 rounded-lg pl-9 text-xs"
          />
        </div>
      </div>

      {state.error ? (
        <p className="text-[11px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}

      <Button
        className="h-10 w-full rounded-lg text-xs font-semibold"
        type="submit"
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle
            className="size-3.5 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <LogIn
            className="size-3.5"
            aria-hidden="true"
          />
        )}

        {pending ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
