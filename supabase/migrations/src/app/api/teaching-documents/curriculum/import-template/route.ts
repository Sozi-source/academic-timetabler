import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/api/teaching-documents/curriculum/templates/course-outline', request.url));
}
