import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getAuthenticatedProfile } from '@/features/auth/queries';
import { createAdminClient } from '@/lib/supabase/admin';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Temporary password must contain at least 8 characters.')
      .max(128, 'Temporary password is too long.'),
    confirmPassword: z
      .string()
      .min(8, 'Confirm the temporary password.')
      .max(128),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

async function findAuthUserByEmail(supabaseAdmin: any, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }

    const match = data.users.find(
      (user: any) => user.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getAuthenticatedProfile();

  if (!profile || (profile.role !== 'system_admin' && profile.role !== 'hod')) {
    return NextResponse.json(
      { error: 'Unauthorized: HOD or administrator credentials required.' },
      { status: 401 },
    );
  }

  const { id: trainerId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 },
    );
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid password.' },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminClient();

  // 1. Look up the trainer record
  const { data: trainer, error: trainerError } = await supabaseAdmin
    .from('trainers')
    .select('id, full_name, email, profile_id, department_id, is_active')
    .eq('id', trainerId)
    .maybeSingle();

  if (trainerError || !trainer) {
    return NextResponse.json(
      { error: 'Trainer not found.' },
      { status: 404 },
    );
  }

  if (!trainer.email) {
    return NextResponse.json(
      { error: 'Trainer does not have an email address recorded. Please add an email before setting a password.' },
      { status: 400 },
    );
  }

  const normalizedEmail = trainer.email.trim().toLowerCase();

  // 2. Find matching Supabase Auth user
  let authUserId = trainer.profile_id;

  if (!authUserId) {
    const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
    }
  }

  // 3. Create or update the Auth user
  if (authUserId) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUserId,
      {
        password: parsed.data.password,
        email_confirm: true,
      },
    );

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update auth password: ${updateError.message}` },
        { status: 500 },
      );
    }
  } else {
    // Create new Supabase Auth user
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: trainer.full_name,
        role: 'trainer',
      },
    });

    if (createError || !createdUser?.user) {
      return NextResponse.json(
        { error: `Failed to create auth user: ${createError?.message || 'Unknown error'}` },
        { status: 500 },
      );
    }

    authUserId = createdUser.user.id;
  }

  // 4. Ensure profile exists and is active with 'trainer' role
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', authUserId)
    .maybeSingle();

  if (existingProfile) {
    await supabaseAdmin
      .from('profiles')
      .update({
        role: existingProfile.role === 'system_admin' ? 'system_admin' : 'trainer',
        is_active: true,
        full_name: trainer.full_name,
        email: normalizedEmail,
        active_department_id: trainer.department_id,
      })
      .eq('id', authUserId);
  } else {
    await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUserId,
        full_name: trainer.full_name,
        email: normalizedEmail,
        role: 'trainer',
        is_active: true,
        active_department_id: trainer.department_id,
      });
  }

  // 5. Link profile to trainer record and activate
  await supabaseAdmin
    .from('trainers')
    .update({
      profile_id: authUserId,
      is_active: true,
    })
    .eq('id', trainerId);

  return NextResponse.json({
    success: true,
    message: `Temporary password set successfully. Staff account for ${trainer.full_name} is now approved and active.`,
  });
}
