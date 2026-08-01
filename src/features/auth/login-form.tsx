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
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
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
          className="block text-sm font-medium text-slate-800"
        >
          Email address
        </label>

        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
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
            className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-600 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 aria-invalid:border-red-400 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-100"
          />
        </div>

        {emailError ? (
          <p
            id="email-error"
            className="text-xs font-medium text-red-700"
          >
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-slate-800"
        >
          Password
        </label>

        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
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
            className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-950 outline-none transition focus:border-slate-600 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 aria-invalid:border-red-400 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-100"
          />
        </div>

        {passwordError ? (
          <p
            id="password-error"
            className="text-xs font-medium text-red-700"
          >
            {passwordError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e293b] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f172a] focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
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