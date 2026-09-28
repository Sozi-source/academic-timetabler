import {
  NextResponse,
} from 'next/server';
import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

export async function POST(
  _request:
    Request,
  {
    params,
  }: {
    params:
      Promise<{
        templateId:
          string;
      }>;
  },
) {
  await requireHodAccess();

  const {
    templateId,
  } =
    await params;

  const supabase =
    (
      await createClient()
    ) as unknown as
      SupabaseClient;

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'retire_teaching_document_template',
      {
        target_template_id:
          templateId,
      },
    );

  if (error) {
    return NextResponse.json(
      {
        message:
          error.message,
      },
      {
        status:
          error.code ===
          '42501'
            ? 403
            : 409,
      },
    );
  }

  return NextResponse.json({
    success:
      true,
    template:
      data,
  });
}
