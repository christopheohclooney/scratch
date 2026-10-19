/*
  One shared password. Signing in sets a signed, http-only cookie that lasts 30
  days. The signing key is AUTH_SECRET, so changing it signs everyone out.
  Uses Web Crypto so it works in the proxy and in route handlers.
*/

export const AUTH_COOKIE = "cwbjj_session";
export const AUTH_DAYS = 30;

const encoder = new TextEncoder();

async function hmac(value: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(sig).toString("base64url");
}

/* Compares in constant time, so the response time doesn't leak how much matched. */
function safeEqual(a: string, b: string) {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export function passwordMatches(attempt: string) {
  const password = process.env.DASHBOARD_PASSWORD;
  return Boolean(password) && safeEqual(attempt, password!);
}

export async function createSessionToken(now = Date.now()) {
  const expires = String(now + AUTH_DAYS * 86_400_000);
  return `${expires}.${await hmac(expires)}`;
}

export async function sessionIsValid(token: string | undefined, now = Date.now()) {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || Number(expires) < now) return false;
  try {
    return safeEqual(sig, await hmac(expires));
  } catch {
    return false;
  }
}
