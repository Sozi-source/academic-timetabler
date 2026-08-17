'use client';

import { useActionState } from 'react';
import { LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { studentPortalLogin, type StudentLoginState } from './actions';

const initialState: StudentLoginState = { error: null };

export function StudentLoginForm() {
  const [state, action, pending] = useActionState(studentPortalLogin, initialState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-primary" htmlFor="admissionNumber">Admission number</label>
        <Input id="admissionNumber" name="admissionNumber" autoComplete="username" required placeholder="CND/J-5678/IC/26" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-primary" htmlFor="pin">Access PIN</label>
        <Input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} required placeholder="6-digit PIN" />
      </div>
      {state.error ? <p className="text-xs font-medium text-danger">{state.error}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>
        <LogIn className="size-4" />
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
