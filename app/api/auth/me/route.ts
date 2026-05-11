import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const username = request.headers.get('x-username');
  return NextResponse.json({ userId: Number(userId), username });
}
