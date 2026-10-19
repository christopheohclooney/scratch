import { describe, expect, it } from "vitest";
import { bookingInsights, siteSummary } from "../lib/insights";
import { biggestDrop, channelRows, funnelSteps } from "../lib/metrics";
import { mockBookings, mockGhl, mockSite } from "../lib/sources/mock";
import { periodsFor } from "../lib/period";
import type { BookingData, GhlState } from "../lib/types";

const periods = periodsFor(7, new Date("2026-10-19T09:00:00Z"));
const bookings = mockBookings(periods, 7);
const connected: GhlState = { state: "ok", data: mockGhl(7) };
const missing: GhlState = { state: "missing" };

describe("periodsFor", () => {
  it("uses whole days ending yesterday in London", () => {
    expect(periods).toEqual({
      current: { from: "2026-10-12", to: "2026-10-18" },
      previous: { from: "2026-10-05", to: "2026-10-11" },
    });
  });
});

describe("bookingInsights", () => {
  it("says there isn't enough data when few people opened the booking page", () => {
    const quiet: BookingData = { ...bookings, funnel: { ...bookings.funnel, current: { ...bookings.funnel.current, opened: 4 } } };
    expect(bookingInsights(quiet, connected, 7)).toEqual([
      "Not enough data yet this week. Fewer than 10 people opened the booking page.",
    ]);
  });

  it("gives the top booking channel and calendar-to-booking rate when GHL is connected", () => {
    const lines = bookingInsights(bookings, connected, 7);
    expect(lines[0]).toMatch(/^Instagram brought in \d+% of trial bookings this week\.$/);
    expect(lines[1]).toMatch(/of people who saw a calendar went on to book, (up|down) from/);
    expect(lines).toHaveLength(3);
  });

  it("leaves out booking sentences until GHL is connected", () => {
    const lines = bookingInsights(bookings, missing, 7);
    expect(lines.join(" ")).not.toMatch(/booking/i);
    expect(lines[0]).toMatch(/reached a calendar/);
    expect(lines[1]).toBe("Most people leave at the programme step.");
  });
});

describe("funnel", () => {
  it("shows the booked step as unavailable without GHL", () => {
    const steps = funnelSteps(bookings.funnel.current, missing);
    expect(steps.at(-1)).toMatchObject({ key: "booked", count: null, dropped: null });
  });

  it("finds the biggest drop", () => {
    const steps = funnelSteps({ opened: 100, audience: 90, programme: 40, calendar: 30, completed: 0 }, missing);
    expect(biggestDrop(steps)?.key).toBe("programme");
  });
});

describe("channelRows", () => {
  it("ranks by reached calendar and hides bookings without GHL", () => {
    const rows = channelRows(bookings, missing);
    expect(rows.every((r) => r.bookings === null)).toBe(true);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].reachedCalendar).toBeGreaterThanOrEqual(rows[i].reachedCalendar);
  });

  it("hides bookings when GHL is connected but completions aren't tracked", () => {
    const rows = channelRows({ ...bookings, completionTracked: false }, connected);
    expect(rows.every((r) => r.bookings === null)).toBe(true);
  });
});

describe("siteSummary", () => {
  it("writes one plain sentence", () => {
    expect(siteSummary(mockSite(periods), 7)).toMatch(/^[\d,]+ visits to the site this week, (up|down) \d+% on last week\.$/);
  });
});
