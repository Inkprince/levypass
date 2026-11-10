import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate (T21): no cookie, no admin or officer screen. Pages and actions check the
// session properly; this only sends people to the right login page quickly.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const gates: [string, string, string][] = [
    ["/admin", "/admin/login", "lp_admin"],
    ["/officer", "/officer/login", "lp_officer"],
    ["/pass", "/login", "lp_trader"],
  ];
  for (const [prefix, login, cookie] of gates) {
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && !pathname.startsWith(login) && !request.cookies.has(cookie)) {
      return NextResponse.redirect(new URL(login, request.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/officer/:path*", "/pass"] };
