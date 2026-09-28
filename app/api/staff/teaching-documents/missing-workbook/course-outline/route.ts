export async function GET() {
  return new Response(
    JSON.stringify({
      error: 'Trainer workbook generation has been deprecated. Course Outlines are centrally managed by the Department.',
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
