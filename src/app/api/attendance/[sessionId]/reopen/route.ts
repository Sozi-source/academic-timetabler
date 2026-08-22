import {
  NextResponse,
} from 'next/server';

interface RouteContext {
  params:
    Promise<{
      sessionId:
        string;
    }>;
}

export async function POST(
  request:
    Request,
  {
    params,
  }: RouteContext,
) {
  const {
    sessionId,
  } =
    await params;

  return NextResponse.redirect(
    new URL(
      `/api/attendance/class-sessions/${sessionId}/reopen`,
      request.url,
    ),
    307,
  );
}
