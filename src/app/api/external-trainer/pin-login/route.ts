import { createHash, createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import { getServerEnvironment } from '@/lib/validation/environment';

const pinSchema = z.object({
  pin: z.string().regex(/^\d{8}$/),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = pinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Enter the 8-digit PIN provided by your department.' }, { status: 400 });
  }

  const admin = createAdminClient({ timeoutMs: 15_000 });
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const clientAddress = forwardedFor || request.headers.get('x-real-ip') || 'unknown';
  const environment = getServerEnvironment();
  const attemptKey = createHmac('sha256', environment.SUPABASE_SERVICE_ROLE_KEY)
    .update(clientAddress)
    .digest('hex');
  const { data: allowed, error: attemptError } = await admin.rpc(
    'consume_external_trainer_pin_login_attempt',
    { target_key_hash: attemptKey },
  );
  if (attemptError) {
    return NextResponse.json({ message: 'Sign-in is temporarily unavailable.' }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ message: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  }

  const pinHash = createHash('sha256').update(parsed.data.pin).digest('hex');
  const { data: pinRecord, error: pinError } = await admin
    .from('external_trainer_access_pins')
    .select('trainer_id')
    .eq('pin_hash', pinHash)
    .maybeSingle();

  if (pinError || !pinRecord) {
    return NextResponse.json({ message: 'That PIN is invalid or has been replaced.' }, { status: 401 });
  }

  await admin.from('external_trainer_pin_login_attempts').delete().eq('key_hash', attemptKey);

  const { data: trainer, error: trainerError } = await admin
    .from('trainers')
    .select('id,profile_id,is_active')
    .eq('id', pinRecord.trainer_id)
    .eq('is_active', true)
    .maybeSingle();

  if (trainerError || !trainer?.profile_id) {
    return NextResponse.json({ message: 'Trainer access is not active. Contact the department.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,email,role,is_active')
    .eq('id', trainer.profile_id)
    .eq('role', 'trainer')
    .eq('is_active', true)
    .maybeSingle();

  if (profileError || !profile?.email) {
    return NextResponse.json({ message: 'Trainer access is not active. Contact the department.' }, { status: 401 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
    options: { redirectTo: new URL('/auth/callback?next=/external-trainer', request.url).toString() },
  });

  if (linkError || !linkData.properties.hashed_token) {
    return NextResponse.json({ message: 'Unable to sign in right now. Please try again.' }, { status: 503 });
  }

  return NextResponse.json({ email: profile.email, tokenHash: linkData.properties.hashed_token });
}
