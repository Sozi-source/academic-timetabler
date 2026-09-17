import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getAuthenticatedProfile } from '@/features/auth/queries';
import { createAdminClient } from '@/lib/supabase/admin';

const LETTERS = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';

/** Generates a password in the format Icmhs@xxxx (e.g. Icmhs@4r7m). */
function generateStudentPassword(): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix +=
      i % 2 === 0
        ? LETTERS.charAt(randomInt(0, LETTERS.length))
        : DIGITS.charAt(randomInt(0, DIGITS.length));
  }
  return `Icmhs@${suffix}`;
}

const resetPasswordSchema = z.object({
  password: z
    .string()
    .trim()
    .min(4, 'Password must contain at least 4 characters.')
    .max(128, 'Password is too long.')
    .optional()
    .or(z.literal('')),
  customPassword: z.string().trim().min(4).max(128).optional().or(z.literal('')),
  newPassword: z.string().trim().min(4).max(128).optional().or(z.literal('')),
  pin: z.string().trim().min(4).max(128).optional().or(z.literal('')),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getAuthenticatedProfile();

  if (!profile || (profile.role !== 'system_admin' && profile.role !== 'hod')) {
    return NextResponse.json(
      {
        error: 'Unauthorized: HOD or administrator credentials required.',
        message: 'Unauthorized: HOD or administrator credentials required.',
      },
      { status: 401 },
    );
  }

  const { id: studentId } = await params;

  // 1. Parse optional custom password from request body
  let rawBody: Record<string, unknown> = {};
  try {
    rawBody = (await request.json()) as Record<string, unknown>;
  } catch {
    // Empty or non-JSON body is acceptable; will auto-generate
    rawBody = {};
  }

  const parsed = resetPasswordSchema.safeParse(rawBody);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? 'Invalid password format.';
    return NextResponse.json(
      { error: errorMsg, message: errorMsg },
      { status: 400 },
    );
  }

  const requestedPassword =
    parsed.data.password ||
    parsed.data.customPassword ||
    parsed.data.newPassword ||
    parsed.data.pin ||
    '';

  const passwordToSet =
    requestedPassword.length >= 4
      ? requestedPassword
      : generateStudentPassword();

  const supabaseAdmin = createAdminClient();

  // 2. Look up the student record
  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id, admission_number, full_name, phone_number, department_id, lifecycle_status')
    .eq('id', studentId)
    .maybeSingle();

  if (studentError || !student) {
    return NextResponse.json(
      { error: 'Student record not found.', message: 'Student record not found.' },
      { status: 404 },
    );
  }

  // 3. Attempt primary RPC: reset_student_portal_password
  const { error: rpcError } = await supabaseAdmin.rpc('reset_student_portal_password', {
    target_student_id: student.id,
    plain_password: passwordToSet,
  });

  if (!rpcError) {
    return NextResponse.json(
      {
        success: true,
        password: passwordToSet,
        pin: passwordToSet,
        message: `Temporary password set successfully for ${student.full_name}. Student can now log in at /student/login.`,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  // 4. Fallback: activate_student_portal_account RPC (hashes new_pin with bcrypt)
  const phoneToUse =
    student.phone_number && student.phone_number.trim().length >= 4
      ? student.phone_number.trim()
      : '0700000000';

  const { error: activateError } = await supabaseAdmin.rpc(
    'activate_student_portal_account',
    {
      supplied_admission_number: student.admission_number,
      supplied_phone_number: phoneToUse,
      new_pin: passwordToSet,
    },
  );

  if (!activateError) {
    return NextResponse.json(
      {
        success: true,
        password: passwordToSet,
        pin: passwordToSet,
        message: `Temporary password set successfully for ${student.full_name}. Student can now log in at /student/login.`,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  // 5. Fallback 2: if password is 6 digits, try set_student_portal_pin
  if (/^\d{6}$/.test(passwordToSet)) {
    const { error: pinError } = await supabaseAdmin.rpc('set_student_portal_pin', {
      target_student_id: student.id,
      plain_pin: passwordToSet,
    });

    if (!pinError) {
      return NextResponse.json(
        {
          success: true,
          password: passwordToSet,
          pin: passwordToSet,
          message: `Temporary password set successfully for ${student.full_name}. Student can now log in at /student/login.`,
        },
        {
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }
  }

  // If all attempts failed, report the specific database error
  const finalError =
    activateError?.message || rpcError?.message || 'Unable to update student credentials.';

  return NextResponse.json(
    { error: finalError, message: finalError },
    { status: 500 },
  );
}
