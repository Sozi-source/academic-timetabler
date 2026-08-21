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
      action={
        action
      }
      className="space-y-4"
    >
      <div>
        <label
          className="mb-1.5 block text-xs font-semibold text-text-primary"
          htmlFor="admissionNumber"
        >
          Admission number
        </label>

        <Input
          id="admissionNumber"
          name="admissionNumber"
          autoComplete="username"
          required
          placeholder="Your admission number"
        />
      </div>

      <div>
        <label
          className="mb-1.5 block text-xs font-semibold text-text-primary"
          htmlFor="pin"
        >
          Access PIN
        </label>

        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />

          <Input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={
              6
            }
            required
            placeholder="6-digit PIN"
            className="pl-10"
          />
        </div>
      </div>

      {state.error ? (
        <p className="text-xs font-medium text-danger">
          {
            state.error
          }
        </p>
      ) : null}

      <Button
        className="w-full"
        type="submit"
        disabled={
          pending
        }
      >
        {pending ? (
          <LoaderCircle
            className="size-4 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <LogIn
            className="size-4"
            aria-hidden="true"
          />
        )}

        {pending
          ? 'Signing in'
          : 'Sign in'}
      </Button>
    </form>
  );
}
