import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookieName, verify } from './lib/session';

/**
 * Everything is private by default. Listing what is public — rather than what
 * is protected — means a route added later is gated unless it is deliberately
 * opened here.
 */
const PUBLIC_PREFIXES = ['/login', '/signup', '/api/auth/', '/api/health'];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );

  const session = await verify(request.cookies.get(sessionCookieName)?.value);

  if (session && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (isPublic || session) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in to continue', code: 'auth' }, { status: 401 });
  }

  const target = new URL('/login', request.url);
  if (pathname !== '/') target.searchParams.set('next', pathname);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
