'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import { studentProfileSchema } from './profile';

import { createStudentPortalSession, getStudentPortalSession, revokeStudentPortalSession } from './session';

export interface StudentLoginState {
  error: string | null;
}

export interface StudentRegistrationState {
  error: string | null;
  success: string | null;
}

const loginSchema = z.object({
  admissionNumber: z.string().trim().min(3).max(80),
  pin: z.string().regex(/^\d{6}$/),
});

export async function studentPortalLogin(
  _state: StudentLoginState,
  formData: FormData,
): Promise<StudentLoginState> {
  const parsed = loginSchema.safeParse({
    admissionNumber: formData.get('admissionNumber'),
    pin: formData.get('pin'),
  });

  if (!parsed.success) return { error: 'Enter your admission number and 6-digit PIN.' };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('authenticate_student_portal', {
    supplied_admission_number: parsed.data.admissionNumber,
    supplied_pin: parsed.data.pin,
  });

  if (error || !data) return { error: 'Admission number or PIN is incorrect.' };

  await createStudentPortalSession(data as string);
  redirect('/student/profile');
}

export async function studentPortalLogout() {
  await revokeStudentPortalSession();
  redirect('/student/login');
}

export async function submitStudentUnitRegistration(
  _state: StudentRegistrationState,
  formData: FormData,
): Promise<StudentRegistrationState> {
  const session = await getStudentPortalSession();
  if (!session) redirect('/student/login');

  const academicPeriodId = formData.get('academicPeriodId');
  const selectedUnitIds = formData.getAll('unitIds').filter((value): value is string => typeof value === 'string');
  const reasonValue = formData.get('exceptionReason');
  const exceptionReason = typeof reasonValue === 'string' ? reasonValue.trim() : '';

  if (typeof academicPeriodId !== 'string' || selectedUnitIds.length === 0) {
    return { error: 'Select at least one unit.', success: null };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('submit_student_unit_registration_for_student', {
    target_student_id: session.studentId,
    target_academic_period_id: academicPeriodId,
    selected_unit_ids: selectedUnitIds,
    supplied_exception_reason: exceptionReason || null,
  });

  if (error) {
    if (error.message.includes('Explain any change')) return { error: 'Give a brief reason for changing the expected units.', success: null };
    if (error.message.includes('already submitted')) return { error: 'This registration is already submitted.', success: null };
    return { error: 'Registration could not be submitted.', success: null };
  }

  return { error: null, success: 'Registration submitted.' };
}

export async function verifyStudentProfile(formData: FormData) {
  const session = await getStudentPortalSession();
  if (!session) redirect('/student/login');
  const parsed = studentProfileSchema.safeParse({
    fullName: formData.get('fullName'),
    kcseIndexNumber: formData.get('kcseIndexNumber'),
    nationalIdNumber: formData.get('nationalIdNumber'),
    phoneNumber: formData.get('phoneNumber'),
    email: formData.get('email'),
  });
  if (!parsed.success) redirect('/student/profile?error=invalid');
  const kcseRaw = parsed.data.kcseIndexNumber?.replace(/\s+/g, '') || null;
  const kcse = kcseRaw && /^\d{11}$/.test(kcseRaw) ? `${kcseRaw.slice(0,8)}/${kcseRaw.slice(8)}` : kcseRaw;
  const admin = createAdminClient();
  const payload = {
    full_name: parsed.data.fullName, kcse_index_number: kcse,
    national_id_number: parsed.data.nationalIdNumber?.replace(/\s+/g, '') || null,
    phone_number: parsed.data.phoneNumber || null, email: parsed.data.email || null, details_verified_at: new Date().toISOString(),
  };
  const { error } = await admin.from('students').update(payload).eq('id', session.studentId);
  if (error) redirect('/student/profile?error=save');
  await admin.from('student_profile_verifications').insert({ student_id: session.studentId, full_name: payload.full_name, kcse_index_number: payload.kcse_index_number, national_id_number: payload.national_id_number, phone_number: payload.phone_number, email: payload.email });
  redirect('/student/unit-registration');
}
