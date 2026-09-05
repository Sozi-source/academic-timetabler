'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { checkRateLimit, clearRateLimit } from '@/lib/security/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

import { studentProfileSchema } from './profile';
import {
  createStudentPortalSession,
  getStudentPortalSession,
  revokeStudentPortalSession,
} from './session';

export interface StudentLoginState {
  error: string | null;
}

export interface StudentActivationState {
  error: string | null;
}

const loginSchema = z.object({
  admissionNumber: z.string().trim().min(3).max(80),
  pin: z.string().trim().min(4).max(60),
});

const activationSchema = z.object({
  admissionNumber: z.string().trim().min(3).max(80),
  phoneNumber: z.string().trim().min(7).max(25),
  newPin: z.string().trim().min(4, 'PIN/Password must be at least 4 characters long').max(60),
  confirmPin: z.string().trim(),
}).refine((data) => data.newPin === data.confirmPin, {
  message: 'PIN/Passwords do not match',
  path: ['confirmPin'],
});

export async function studentPortalLogin(
  _state: StudentLoginState,
  formData: FormData,
): Promise<StudentLoginState> {
  const parsed = loginSchema.safeParse({
    admissionNumber: formData.get('admissionNumber'),
    pin: formData.get('pin'),
  });

  if (!parsed.success) {
    return {
      error: 'Please enter your admission number and PIN/password.',
    };
  }

  const rateCheck = checkRateLimit(
    `student-login:${parsed.data.admissionNumber.toUpperCase()}`,
    5,
    15 * 60 * 1000,
  );

  if (!rateCheck.success) {
    const minutes = Math.ceil((rateCheck.retryAfterSec ?? 60) / 60);
    return {
      error: `Too many unsuccessful login attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`,
    };
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc('authenticate_student_portal', {
    supplied_admission_number: parsed.data.admissionNumber,
    supplied_pin: parsed.data.pin,
  });

  if (error || !data) {
    return {
      error: 'Admission number or PIN/password is incorrect.',
    };
  }

  clearRateLimit(`student-login:${parsed.data.admissionNumber.toUpperCase()}`);

  await createStudentPortalSession(data as string);

  redirect('/student');
}

export async function activateStudentAccount(
  _state: StudentActivationState,
  formData: FormData,
): Promise<StudentActivationState> {
  const parsed = activationSchema.safeParse({
    admissionNumber: formData.get('admissionNumber'),
    phoneNumber: formData.get('phoneNumber'),
    newPin: formData.get('newPin'),
    confirmPin: formData.get('confirmPin'),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      error: firstIssue ? firstIssue.message : 'Please check your details and try again.',
    };
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc('activate_student_portal_account', {
    supplied_admission_number: parsed.data.admissionNumber,
    supplied_phone_number: parsed.data.phoneNumber,
    new_pin: parsed.data.newPin,
  });

  if (error || !data) {
    return {
      error: error?.message || 'Unable to activate account. Verify your admission & phone number.',
    };
  }

  await createStudentPortalSession(data as string);

  redirect('/student');
}

export async function studentPortalLogout() {
  await revokeStudentPortalSession();

  redirect('/student/login');
}

export async function verifyStudentProfile(formData: FormData) {
  const session = await getStudentPortalSession();

  if (!session) {
    redirect('/student/login');
  }

  const parsed = studentProfileSchema.safeParse({
    fullName: formData.get('fullName'),
    kcseIndexNumber: formData.get('kcseIndexNumber'),
    nationalIdNumber: formData.get('nationalIdNumber'),
    phoneNumber: formData.get('phoneNumber'),
    email: formData.get('email'),
  });

  if (!parsed.success) {
    redirect('/student/profile?error=invalid');
  }

  const kcseRaw = parsed.data.kcseIndexNumber?.replace(/\s+/g, '') || null;
  const kcse = kcseRaw && /^\d{11}$/.test(kcseRaw)
    ? `${kcseRaw.slice(0, 8)}/${kcseRaw.slice(8)}`
    : kcseRaw;

  const admin = createAdminClient();

  const payload = {
    full_name: parsed.data.fullName,
    kcse_index_number: kcse,
    national_id_number: parsed.data.nationalIdNumber?.replace(/\s+/g, '') || null,
    phone_number: parsed.data.phoneNumber || null,
    email: parsed.data.email || null,
    details_verified_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from('students')
    .update(payload)
    .eq('id', session.studentId);

  if (error) {
    redirect('/student/profile?error=save');
  }

  await admin.from('student_profile_verifications').insert({
    student_id: session.studentId,
    full_name: payload.full_name,
    kcse_index_number: payload.kcse_index_number,
    national_id_number: payload.national_id_number,
    phone_number: payload.phone_number,
    email: payload.email,
  });

  redirect('/student/profile?saved=1');
}
