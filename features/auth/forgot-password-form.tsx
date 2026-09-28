'use client';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';

import { initialPasswordResetActionState } from './action-types';
import { requestPasswordResetAction } from './actions';

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialPasswordResetActionState,
  );

  const emailError = state.fieldErrors?.email?.[0];

  return (
    <div className="space-y-4">
      {state.status === 'success' ? (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-bold text-emerald-900">
              Password Reset Link Sent
            </h2>
            <p className="text-xs text-emerald-800 leading-relaxed">
              {state.message}
            </p>
          </div>

          <p className="text-[11px] text-gray-500">
            Click the link inside the email to securely set your new password. If you don’t see it in 2 minutes, check your spam/junk folder.
          </p>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition"
            >
              <ArrowLeft className="size-3.5" />
              Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-4" noValidate>
          {state.message && state.status === 'error' ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <p>{state.message}</p>
            </div>
          ) : null}

          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-gray-900"
            >
              College Email Address
            </label>

            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400"
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
                placeholder="fiona.kwamboka@icmhs.co.ke"
                className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-xs text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#033B36] focus:ring-1 focus:ring-[#033B36] disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            {emailError ? (
              <p className="text-[11px] font-medium text-red-600">
                {emailError}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#033B36] px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#022A26] focus:outline-none focus:ring-2 focus:ring-[#033B36]/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Sending recovery link...
              </>
            ) : (
              <>
                <KeyRound className="size-3.5" aria-hidden="true" />
                Send Password Reset Link
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1 text-center text-xs text-gray-500 pt-1">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 font-semibold text-[#033B36] hover:underline"
            >
              <ArrowLeft className="size-3" />
              Return to Login
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
