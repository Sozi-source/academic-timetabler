import {
  generateMissingTrainerWorkbookV53,
} from '@/features/teaching-documents/trainer-workbook-v53/workbook';
import {
  loadMissingTrainerDocumentsV53,
} from '@/features/teaching-documents/trainer-workbook-v53/queries';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', {
      status: 401,
    });
  }

  const missing =
    await loadMissingTrainerDocumentsV53(
      'scheme_of_work',
    );

  if (!missing.length) {
    return new Response(
      'All Schemes of Work are up to date.',
      { status: 409 },
    );
  }

  const buffer =
    await generateMissingTrainerWorkbookV53(
      'scheme_of_work',
      missing,
      user.id,
    );

  return new Response(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="Missing_Schemes_of_Work.xlsx"',
    },
  });
}
