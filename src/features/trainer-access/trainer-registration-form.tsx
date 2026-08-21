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
      onSubmit={
        submit
      }
      className="space-y-4"
    >
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] leading-5 text-red-800">
          <AlertCircle
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          {
            error
          }
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2.5 text-[11px] leading-5 text-text-secondary">
          <CheckCircle2
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          {
            notice
          }
        </div>
      ) : null}

      <div>
        <label
          htmlFor="staff-email"
          className="text-xs font-semibold text-text-secondary"
        >
          Registered email
        </label>

        <div className="relative mt-1.5">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />

          <input
            id="staff-email"
            type="email"
            autoComplete="email"
            required
            disabled={
              pending
            }
            value={
              email
            }
            onChange={
              (
                event,
              ) =>
                setEmail(
                  event.target.value,
                )
            }
            className="h-11 w-full rounded-lg border border-border-strong bg-white pl-10 pr-3 text-sm text-text-primary outline-none transition focus:border-header-blue focus:ring-4 focus:ring-header-blue/10 disabled:bg-surface-subtle"
            placeholder="name@example.com"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="staff-password"
          className="text-xs font-semibold text-text-secondary"
        >
          Password
        </label>

        <div className="relative mt-1.5">
          <LockKeyhole
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />

          <input
            id="staff-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={
              8
            }
            disabled={
              pending
            }
            value={
              password
            }
            onChange={
              (
                event,
              ) =>
                setPassword(
                  event.target.value,
                )
            }
            className="h-11 w-full rounded-lg border border-border-strong bg-white pl-10 pr-3 text-sm text-text-primary outline-none transition focus:border-header-blue focus:ring-4 focus:ring-header-blue/10 disabled:bg-surface-subtle"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="staff-password-confirm"
          className="text-xs font-semibold text-text-secondary"
        >
          Confirm password
        </label>

        <input
          id="staff-password-confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={
            8
          }
          disabled={
            pending
          }
          value={
            confirmPassword
          }
          onChange={
            (
              event,
            ) =>
              setConfirmPassword(
                event.target.value,
              )
          }
          className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-white px-3 text-sm text-text-primary outline-none transition focus:border-header-blue focus:ring-4 focus:ring-header-blue/10 disabled:bg-surface-subtle"
        />
      </div>

      <button
        type="submit"
        disabled={
          pending
        }
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-header-blue px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle
            className="size-4 animate-spin"
            aria-hidden="true"
          />
        ) : null}

        {pending
          ? 'Creating account'
          : 'Create staff account'}
      </button>

      <p className="text-center text-[11px] text-text-muted">
        Already registered?{' '}
        <Link
          href="/login"
          className="font-semibold text-header-blue hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
