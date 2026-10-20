import { NextResponse } from 'next/server';

import { getGoogleConnectionStatus } from '@/features/assessment/google-oauth';
import { requireHodAccess } from '@/features/auth/authorization';

export async function GET() {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) {
    return NextResponse.json({ connected: false, email: null }, { status: 200 });
  }

  try {
    return NextResponse.json(await getGoogleConnectionStatus(profile.activeDepartmentId));
  } catch {
    return NextResponse.json({ message: 'Could not read the department Google connection.' }, { status: 500 });
  }
}
