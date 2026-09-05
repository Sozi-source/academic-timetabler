'use client';

import { KeyRound, LoaderCircle, Phone, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { activateStudentAccount, type StudentActivationState } from './actions';

const initialState: StudentActivationState = {
  error: null,
};

export function StudentActivationForm() {
  const [state, action, pending] = useActionState(activateStudentAccount, initialState);

  return (
    <form action={action} className="space-y-4">
      {/* Admission Number */}
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

      {/* Phone Number */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-text-primary" htmlFor="phoneNumber">
          Registered Phone Number
        </label>
        <div className="relative">
          <Phone
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            required
            placeholder="e.g. 0712345678"
            className="h-10 rounded-lg pl-9 text-xs"
          />
        </div>
        <p className="text-[10px] text-text-muted">Enter phone number used during college application/admission.</p>
      </div>

      {/* New Preferred PIN / Password */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-text-primary" htmlFor="newPin">
          Set Preferred PIN / Password
        </label>
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            id="newPin"
            name="newPin"
            type="password"
            required
            minLength={4}
            placeholder="Create PIN or password (min 4 characters)"
            className="h-10 rounded-lg pl-9 text-xs"
          />
        </div>
      </div>

      {/* Confirm Preferred PIN */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-text-primary" htmlFor="confirmPin">
          Confirm Preferred PIN / Password
        </label>
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            id="confirmPin"
            name="confirmPin"
            type="password"
            required
            minLength={4}
            placeholder="Re-enter chosen PIN or password"
            className="h-10 rounded-lg pl-9 text-xs"
          />
        </div>
      </div>

      {state.error && (
        <div className="rounded-lg border border-danger-border bg-danger-surface p-2.5 text-[11px] font-semibold text-danger">
          {state.error}
        </div>
      )}

      <Button
        className="h-10 w-full rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-hover transition"
        type="submit"
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <UserCheck className="size-3.5" aria-hidden="true" />
        )}
        {pending ? 'Activating account...' : 'Activate Account & Set PIN'}
      </Button>

      <div className="pt-2 text-center border-t border-border">
        <Link
          href="/student/login"
          className="text-xs font-semibold text-text-muted hover:text-text-primary transition"
        >
          Already activated your account? <span className="font-bold text-primary">Sign in</span>
        </Link>
      </div>
    </form>
  );
}
