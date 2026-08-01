'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import type { LoginActionState } from './action-types';
import {
  getSafeInternalPath,
  loginSchema,
} from './validation';

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    nextPath: formData.get('nextPath') || undefined,
  });

  if (!parsed.success) {
    const fieldErrors =
      parsed.error.flatten().fieldErrors;

    return {
      status: 'error',
      message: 'Review the highlighted fields.',
      fieldErrors: {
        email: fieldErrors.email,
        password: fieldErrors.password,
      },
    };
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

  if (error) {
    /*
     * Use one neutral message so the interface does not reveal
     * whether a particular email address exists.
     */
    return {
      status: 'error',
      message:
        'The email address or password is incorrect.',
    };
  }

  const destination = getSafeInternalPath(
    parsed.data.nextPath,
  );

  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect('/login');
}