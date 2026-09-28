'use client';

import Link from 'next/link';

import {
  AlertCircle,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  Mail,
} from 'lucide-react';
import { useActionState } from 'react';

import {
  initialLoginActionState,
} from './action-types';
import { loginAction } from './actions';

interface LoginFormProps {
  nextPath?: string;
}

export function LoginForm({
  nextPath,
}: LoginFormProps) {
  const [state, formAction, pending] =
    useActionState(
      loginAction,
      initialLoginActionState,
    );

  const emailError =
    state.fieldErrors?.email?.[0];

  const passwordError =
    state.fieldErrors?.password?.[0];

  return (
    <form
      action={formAction}
      className="space-y-3.5"
      noValidate
    >
      <input
        type="hidden"
        name="nextPath"
        value={nextPath ?? ''}
      />

      {state.message ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-xs text-danger"
        >
          <AlertCircle
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />

          <p>{state.message}</p>
        </div>
      ) : null}

      <div className="space-y-1">
        <label
          htmlFor="email"
          className="block text-xs font-semibold text-text-primary"
        >
          Email address
        </label>

        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            disabled={pending}
            aria-invalid={Boolean(emailError)}
            aria-describedby={
              emailError
                ? 'email-error'
                : undefined
            }
            placeholder="name@college.ac.ke"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs text-text-primary outline-none transition placeholder:text-text-muted hover:border-focus-border focus:border-focus-border focus:ring-2 focus:ring-focus-ring/25 disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-danger aria-invalid:focus:ring-danger-border/40"
          />
        </div>

        {emailError ? (
          <p
            id="email-error"
            className="text-[11px] font-medium text-danger"
          >
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-text-primary"
          >
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={
              passwordError
                ? 'password-error'
                : undefined
            }
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs text-text-primary outline-none transition hover:border-focus-border focus:border-focus-border focus:ring-2 focus:ring-focus-ring/25 disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-danger aria-invalid:focus:ring-danger-border/40"
          />
        </div>

        {passwordError ? (
          <p
            id="password-error"
            className="text-[11px] font-medium text-danger"
          >
            {passwordError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-focus-ring/40 disabled:cursor-not-allowed disabled:opacity-65"
      >
        {pending ? (
          <>
            <LoaderCircle
              className="size-3.5 animate-spin"
              aria-hidden="true"
            />
            Signing in...
          </>
        ) : (
          <>
            <LogIn
              className="size-3.5"
              aria-hidden="true"
            />
            Sign in
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-text-muted">
        New staff member?{' '}
        <Link
          href="/staff/register"
          className="font-semibold text-primary hover:underline"
        >
          Create staff account
        </Link>
      </p>
    </form>
  );
}