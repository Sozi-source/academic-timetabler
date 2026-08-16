'use client';

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
      className="space-y-5"
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
          className="flex items-start gap-3 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger"
        >
          <AlertCircle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />

          <p>{state.message}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-text-primary"
        >
          Email address
        </label>

        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
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
            className="h-12 w-full rounded-xl border border-border-strong bg-surface pl-10 pr-4 text-sm text-text-primary outline-none transition placeholder:text-text-subtle hover:border-focus-border focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25 disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-danger aria-invalid:focus:ring-danger-border/40"
          />
        </div>

        {emailError ? (
          <p
            id="email-error"
            className="text-xs font-medium text-danger"
          >
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-text-primary"
        >
          Password
        </label>

        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
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
            className="h-12 w-full rounded-xl border border-border-strong bg-surface pl-10 pr-4 text-sm text-text-primary outline-none transition hover:border-focus-border focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25 disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-danger aria-invalid:focus:ring-danger-border/40"
          />
        </div>

        {passwordError ? (
          <p
            id="password-error"
            className="text-xs font-medium text-danger"
          >
            {passwordError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover focus:outline-none focus:ring-4 focus:ring-focus-ring/40 disabled:cursor-not-allowed disabled:opacity-65"
      >
        {pending ? (
          <>
            <LoaderCircle
              className="size-4 animate-spin"
              aria-hidden="true"
            />
            Signing in
          </>
        ) : (
          <>
            <LogIn
              className="size-4"
              aria-hidden="true"
            />
            Sign in
          </>
        )}
      </button>
    </form>
  );
}