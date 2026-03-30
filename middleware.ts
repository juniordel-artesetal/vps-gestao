import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Protege todas as rotas /master EXCETO /master/login
  if (pathname.startsWith('/master') && !pathname.startsWith('/master/login')) {
    const token = req.cookies.get('master_token')?.value

    if (!token || token !== process.env.MASTER_SECRET_TOKEN) {
      return NextResponse.redirect(new URL('/master/login', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/master/:path*'],
}
