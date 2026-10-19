import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, passwordMatches, sessionIsValid } from "../lib/auth";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret";
  process.env.DASHBOARD_PASSWORD = "open sesame";
});

describe("auth", () => {
  it("checks the password", () => {
    expect(passwordMatches("open sesame")).toBe(true);
    expect(passwordMatches("open sesam")).toBe(false);
  });

  it("accepts its own tokens until they expire", async () => {
    const now = Date.now();
    const token = await createSessionToken(now);
    expect(await sessionIsValid(token, now)).toBe(true);
    expect(await sessionIsValid(token, now + 31 * 86_400_000)).toBe(false);
  });

  it("rejects tampered tokens", async () => {
    const token = await createSessionToken();
    const [, sig] = token.split(".");
    expect(await sessionIsValid(`${Date.now() + 999 * 86_400_000}.${sig}`)).toBe(false);
    expect(await sessionIsValid(undefined)).toBe(false);
  });
});
