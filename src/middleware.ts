// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { isOriginAllowed } from './lib/origin-helpers';

export function middleware(request: NextRequest) {
  // Only check for API routes and server actions
  if (request.nextUrl.pathname.startsWith('/api') || request.nextUrl.pathname.startsWith('/_next/data')) {
    const origin = request.headers.get('origin');
    const xForwardedHost = request.headers.get('x-forwarded-host');
    if (!isOriginAllowed(origin ?? undefined, xForwardedHost ?? undefined)) {
      return new NextResponse('Invalid origin or host (CSRF protection)', { status: 403 });
    }
  }
  return NextResponse.next();
}

// Enable middleware for all API routes and server actions
export const config = {
  matcher: ['/api/:path*', '/_next/data/:path*'],
}