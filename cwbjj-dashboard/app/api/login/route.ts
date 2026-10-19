import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_DAYS, createSessionToken, passwordMatches } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  if (!passwordMatches(password)) {
    /* A short pause makes guessing slow. */
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(AUTH_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_DAYS * 86_400,
  });
  return response;
}
