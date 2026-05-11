import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signToken, COOKIE_NAME } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/signup', '/api/auth/login', '/api/auth/signup'];
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const headers = new Headers(request.headers);
  headers.set('x-user-id', String(payload.userId));
  headers.set('x-username', payload.username);

  const response = NextResponse.next({ request: { headers } });

  // Slide the session window — issue a fresh token on every request
  const fresh = signToken({ userId: payload.userId, username: payload.username });
  response.cookies.set(COOKIE_NAME, fresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
