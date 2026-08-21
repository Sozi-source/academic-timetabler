'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import type { LoginActionState } from './action-types';
import {
  canUsePostLoginPath,
  getHomePathForRole,
} from './routing';
import type { AppRole } from './types';
import {
  getSafeInternalPath,
  loginSchema,
} from './validation';

interface LoginProfileRow {
  role: AppRole;
  is_active: boolean;
}

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

  const {
    data: authData,
    error: signInError,
  } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signInError) {
    return {
      status: 'error',
      message:
        'The email address or password is incorrect.',
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle<LoginProfileRow>();

  if (
    profileError ||
    !profile ||
    !profile.is_active
  ) {
    await supabase.auth.signOut();

    return {
      status: 'error',
      message:
        'Your account is not active in Academic Planner.',
    };
  }

  const requestedDestination =
    parsed.data.nextPath
      ? getSafeInternalPath(
          parsed.data.nextPath,
        )
      : null;

  const destination =
    requestedDestination &&
    canUsePostLoginPath(
      profile.role,
      requestedDestination,
    )
      ? requestedDestination
      : getHomePathForRole(
          profile.role,
        );

  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect('/login');
}
