import 'server-only';

import {
  NextResponse,
  type NextRequest,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  generateImportTemplate,
} from '@/features/imports/template-generator';
import {
  getImportTemplateDefinition,
} from '@/features/imports/templates';

interface ImportTemplateRouteProps {
  params: Promise<{
    entity: string;
  }>;
}

export async function GET(
  _request: NextRequest,
  {
    params,
  }: ImportTemplateRouteProps,
) {
  await requireHodAccess();

  const { entity } = await params;

  const definition =
    getImportTemplateDefinition(entity);

  if (!definition) {
    return NextResponse.json(
      {
        message:
          'The requested import template is not available.',
      },
      {
        status: 404,
      },
    );
  }

  const workbook =
    await generateImportTemplate(
      definition,
    );

  const fileName =
    `${definition.entityType}-import-template-v${definition.version}.xlsx`;

  return new NextResponse(
    new Uint8Array(workbook),
    {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          `attachment; filename="${fileName}"`,
        'Cache-Control':
          'private, no-store, max-age=0',
        'X-Content-Type-Options':
          'nosniff',
      },
    },
  );
}