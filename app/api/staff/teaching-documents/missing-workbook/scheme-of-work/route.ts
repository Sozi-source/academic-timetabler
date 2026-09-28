export async function GET() {
  return new Response(
    JSON.stringify({
      error: 'Trainer workbook generation has been deprecated. Schemes of Work are centrally managed by the Department.',
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
