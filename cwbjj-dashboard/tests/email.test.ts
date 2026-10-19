import { describe, expect, it } from "vitest";
import { weeklyEmail } from "../lib/email";
import { mockBookings, mockGhl, mockSite } from "../lib/sources/mock";
import { periodsFor } from "../lib/period";
import type { DashboardData } from "../lib/types";

const periods = periodsFor(7, new Date("2026-10-19T09:00:00Z"));
const base: DashboardData = {
  range: 7,
  periods,
  site: { ok: true, data: mockSite(periods) },
  bookings: { ok: true, data: mockBookings(periods, 7) },
  ghl: { state: "ok", data: mockGhl(7) },
  updatedAt: new Date().toISOString(),
  mock: true,
};

describe("weeklyEmail", () => {
  it("leads with trial bookings when GHL is connected", () => {
    const email = weeklyEmail(base, "https://example.com");
    expect(email.subject).toMatch(/^Your website this week: \d+ trial bookings, (up|down) \d+$/);
    expect(email.html).toContain("Open the dashboard");
  });

  it("leaves out bookings when GHL isn't connected", () => {
    const email = weeklyEmail({ ...base, ghl: { state: "missing" } }, "https://example.com");
    expect(email.subject).toMatch(/visits/);
    expect(email.text).not.toMatch(/trial booking/i);
  });
});
