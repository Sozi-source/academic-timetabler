'use client';

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import { initialUpdatePasswordActionState } from './action-types';
import { updatePasswordAction } from './actions';

export function ResetPasswordForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    initialUpdatePasswordActionState,
  );

  const passwordError = state.fieldErrors?.password?.[0];
  const confirmPasswordError = state.fieldErrors?.confirmPassword?.[0];

  useEffect(() => {
    if (state.status === 'success') {
      const timer = setTimeout(() => {
        router.push('/staff');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state.status, router]);

  return (
    <div className="space-y-4">
      {state.status === 'success' ? (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-bold text-emerald-900">
              Password Changed Successfully!
            </h2>
            <p className="text-xs text-emerald-800 leading-relaxed">
              {state.message}
            </p>
          </div>

          <p className="text-[11px] text-gray-500">
            Redirecting to your Staff Workspace in a few seconds...
          </p>

          <div className="pt-2">
            <Link
              href="/staff"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#033B36] px-4 text-xs font-semibold text-white shadow-2xs hover:bg-[#022A26] transition"
            >
              Go to Staff Portal
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

          {/* New Password */}
          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-gray-900"
            >
              New Password
            </label>

            <div className="relative">
              <LockKeyhole
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />

              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                disabled={pending}
                placeholder="At least 8 characters"
                className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-10 text-xs text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#033B36] focus:ring-1 focus:ring-[#033B36] disabled:cursor-not-allowed disabled:bg-gray-100"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {passwordError ? (
              <p className="text-[11px] font-medium text-red-600">
                {passwordError}
              </p>
            ) : null}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1">
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold text-gray-900"
            >
              Confirm New Password
            </label>

            <div className="relative">
              <LockKeyhole
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />

              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                disabled={pending}
                placeholder="Re-enter your new password"
                className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-xs text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#033B36] focus:ring-1 focus:ring-[#033B36] disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            {confirmPasswordError ? (
              <p className="text-[11px] font-medium text-red-600">
                {confirmPasswordError}
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
                Updating password...
              </>
            ) : (
              <>
                <KeyRound className="size-3.5" aria-hidden="true" />
                Save New Password & Continue
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
