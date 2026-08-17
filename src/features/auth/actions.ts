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

  const { data: authData, error } =
    await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

  if (error) {
    return {
      status: 'error',
      message:
        'The email address or password is incorrect.',
    };
  }

  if (parsed.data.nextPath) {
    redirect(getSafeInternalPath(parsed.data.nextPath));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle<{ role: 'system_admin' | 'hod' | 'trainer' }>();

  redirect(profile?.role === 'trainer' ? '/trainer/exam-attendance' : '/dashboard');
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect('/login');
}
