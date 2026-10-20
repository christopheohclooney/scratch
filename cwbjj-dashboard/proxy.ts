import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, sessionIsValid } from "./lib/auth";

/* Everything needs the password except the sign-in page and the weekly email cron. */
export async function proxy(request: NextRequest) {
  if (await sessionIsValid(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|api/login|api/cron|_next/static|_next/image|favicon.ico|icon.svg|cwbjj-logo.svg).*)"],
};
