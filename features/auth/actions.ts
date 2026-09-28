'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

import type {
  LoginActionState,
  PasswordResetActionState,
  UpdatePasswordActionState,
} from './action-types';
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

export async function requestPasswordResetAction(
  _previousState: PasswordResetActionState,
  formData: FormData,
): Promise<PasswordResetActionState> {
  const emailRaw = formData.get('email');
  const emailParsed = z
    .string()
    .trim()
    .email('Enter a valid college email address.')
    .safeParse(emailRaw);

  if (!emailParsed.success) {
    return {
      status: 'error',
      message: 'Enter a valid college email address.',
      fieldErrors: {
        email: emailParsed.error.flatten().formErrors,
      },
    };
  }

  const email = emailParsed.data.toLowerCase();
  const supabase = await createClient();

  const reqHeaders = await headers();
  const host = reqHeaders.get('host') || 'localhost:3000';
  const proto = reqHeaders.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const origin = reqHeaders.get('origin') || `${proto}://${host}`;
  const redirectTo = `${origin}/auth/callback?next=/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error('Password reset email error:', error.message);
  }

  return {
    status: 'success',
    email,
    message: `If an account exists for ${email}, a password recovery link has been sent to your inbox.`,
  };
}

export async function updatePasswordAction(
  _previousState: UpdatePasswordActionState,
  formData: FormData,
): Promise<UpdatePasswordActionState> {
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (password.length < 8) {
    return {
      status: 'error',
      message: 'Password must contain at least 8 characters.',
      fieldErrors: {
        password: ['Password must contain at least 8 characters.'],
      },
    };
  }

  if (password !== confirmPassword) {
    return {
      status: 'error',
      message: 'Passwords do not match.',
      fieldErrors: {
        confirmPassword: ['Passwords do not match.'],
      },
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return {
      status: 'error',
      message: error.message || 'Unable to update password. Your reset session may have expired.',
    };
  }

  return {
    status: 'success',
    message: 'Your password has been successfully updated. You can now access your staff workspace.',
  };
}

