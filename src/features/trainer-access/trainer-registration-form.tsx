'use client';

import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import {
  type FormEvent,
  useState,
} from 'react';

import {
  createClient,
} from '@/lib/supabase/client';

export function TrainerRegistrationForm() {
  const [
    email,
    setEmail,
  ] =
    useState('');

  const [
    password,
    setPassword,
  ] =
    useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    notice,
    setNotice,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    pending,
    setPending,
  ] =
    useState(
      false,
    );

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(
      null,
    );

    setNotice(
      null,
    );

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (
      password.length <
      8
    ) {
      setError(
        'Use at least 8 characters.',
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        'Passwords do not match.',
      );
      return;
    }

    setPending(
      true,
    );

    try {
      const supabase =
        createClient();

      const callback =
        `${window.location.origin}/auth/callback?next=/staff`;

      const {
        data,
        error:
          signupError,
      } =
        await supabase.auth.signUp({
          email:
            normalizedEmail,
          password,
          options: {
            emailRedirectTo:
              callback,
            data: {
              role:
                'trainer',
            },
          },
        });

      if (
        signupError
      ) {
        setError(
          signupError.message,
        );
        return;
      }

      if (
        data.session &&
        data.user
      ) {
        const {
          data:
            profile,
        } =
          await supabase
            .from(
              'profiles',
            )
            .select(
              'role, is_active',
            )
            .eq(
              'id',
              data.user.id,
            )
            .maybeSingle();

        if (
          profile
            ?.role ===
            'trainer' &&
          profile
            .is_active
        ) {
          window.location.assign(
            '/staff',
          );
          return;
        }

        await supabase.auth.signOut();

        setError(
          'Your account was created, but staff access is not active. Contact your department.',
        );
        return;
      }

      setNotice(
        'Account created. Check your email to confirm it, then sign in.',
      );
    } catch {
      setError(
        'Unable to create the staff account. Please try again.',
      );
    } finally {
      setPending(
        false,
      );
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3.5"
    >
      {error ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-xs text-danger">
          <AlertCircle
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <p>{error}</p>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
          <CheckCircle2
            className="mt-0.5 size-3.5 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <p>{notice}</p>
        </div>
      ) : null}

      <div className="space-y-1">
        <label
          htmlFor="staff-email"
          className="block text-xs font-semibold text-text-primary"
        >
          Registered departmental email
        </label>

        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />

          <input
            id="staff-email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs text-text-primary outline-none transition placeholder:text-text-muted hover:border-focus-border focus:border-focus-border focus:ring-2 focus:ring-focus-ring/25 disabled:bg-surface-muted"
            placeholder="name@college.ac.ke"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="staff-password"
          className="block text-xs font-semibold text-text-primary"
        >
          Create password
        </label>

        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />

          <input
            id="staff-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={pending}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs text-text-primary outline-none transition hover:border-focus-border focus:border-focus-border focus:ring-2 focus:ring-focus-ring/25 disabled:bg-surface-muted"
            placeholder="Min. 8 characters"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="staff-password-confirm"
          className="block text-xs font-semibold text-text-primary"
        >
          Confirm password
        </label>

        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />

          <input
            id="staff-password-confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={pending}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs text-text-primary outline-none transition hover:border-focus-border focus:border-focus-border focus:ring-2 focus:ring-focus-ring/25 disabled:bg-surface-muted"
            placeholder="Repeat password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-focus-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <LoaderCircle
              className="size-3.5 animate-spin"
              aria-hidden="true"
            />
            Creating account...
          </>
        ) : (
          'Activate Staff Account'
        )}
      </button>

      <p className="text-center text-[11px] text-text-muted">
        Already registered?{' '}
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline"
        >
          Sign in →
        </Link>
      </p>
    </form>
  );
}
