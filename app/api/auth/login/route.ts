import { NextRequest, NextResponse } from 'next/server';
import { getHardcodedUsers, verifyPassword, signToken, COOKIE_NAME } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Check hardcoded env-var users first
  const hardcoded = getHardcodedUsers();
  const hardcodedMatch = hardcoded.find((u) => u.username.toLowerCase() === username.toLowerCase());

  if (hardcodedMatch) {
    if (!verifyPassword(password, hardcodedMatch.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const [dbUser] = await db
      .insert(users)
      .values({ username: hardcodedMatch.username, passwordHash: hardcodedMatch.passwordHash })
      .onConflictDoUpdate({ target: users.username, set: { passwordHash: hardcodedMatch.passwordHash } })
      .returning();
    const token = signToken({ userId: dbUser.id, username: dbUser.username });
    const response = NextResponse.json({ ok: true, username: dbUser.username });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  }

  // Fall back to DB users (signed up via /signup)
  const dbUser = await db.query.users.findFirst({
    where: eq(users.username, username.toLowerCase()),
  });
  if (!dbUser || !verifyPassword(password, dbUser.passwordHash)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = signToken({ userId: dbUser.id, username: dbUser.username });
  const response = NextResponse.json({ ok: true, username: dbUser.username });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return response;
}
