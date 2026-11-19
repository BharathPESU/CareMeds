import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/rounds',
  '/residents',
  '/medicines',
  '/prescriptions',
  '/inventory',
  '/vitals',
  '/alerts',
  '/emergency',
  '/reports',
  '/assistant',
  '/profile',
  '/admin',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get('caremeds_session')?.value;
  if (!sessionCookie) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/rounds/:path*',
    '/residents/:path*',
    '/medicines/:path*',
    '/prescriptions/:path*',
    '/inventory/:path*',
    '/vitals/:path*',
    '/alerts/:path*',
    '/emergency/:path*',
    '/reports/:path*',
    '/assistant/:path*',
    '/profile/:path*',
    '/admin/:path*',
  ],
};
