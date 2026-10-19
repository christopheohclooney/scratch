import { channelLabels, channelTotals, type ChannelKey } from "./config/channels";
import { programmes } from "./config/site";
import { share } from "./format";
import type { BookingData, FunnelCounts, GhlState } from "./types";

export const MIN_SAMPLE = 10;

export type StepKey = keyof FunnelCounts | "booked";

export interface FunnelStep {
  key: StepKey;
  label: string;
  /* Short name used in sentences: "Most people leave at the programme step." */
  stepName: string;
  count: number | null;
  /* Share of the people who opened the booking page. */
  ofOpened: number | null;
  /* People lost since the previous step. */
  dropped: number | null;
}

export function funnelSteps(counts: FunnelCounts, ghl: GhlState, ghlBookings?: number): FunnelStep[] {
  const booked = ghl.state === "ok" ? (ghlBookings ?? 0) : null;
  const raw: [StepKey, string, string, number | null][] = [
    ["opened", "Opened the booking page", "booking page", counts.opened],
    ["audience", "Chose Adult or Child", "Adult or Child step", counts.audience],
    ["programme", "Chose a programme", "programme step", counts.programme],
    ["calendar", "Saw the calendar", "calendar", counts.calendar],
    ["booked", "Booked and paid", "booking and payment step", booked],
  ];
  return raw.map(([key, label, stepName, count], i) => {
    const before = i > 0 ? raw[i - 1][3] : null;
    return {
      key,
      label,
      stepName,
      count,
      ofOpened: count === null ? null : share(count, counts.opened),
      dropped: count === null || before === null ? null : Math.max(0, before - count),
    };
  });
}

/* The step where the most people left. Ties go to the earlier step. */
export function biggestDrop(steps: FunnelStep[]): FunnelStep | null {
  let worst: FunnelStep | null = null;
  for (const s of steps) if (s.dropped !== null && s.dropped > 0 && (!worst || s.dropped > worst.dropped!)) worst = s;
  return worst;
}

export interface ChannelRow {
  key: ChannelKey;
  label: string;
  visits: number;
  reachedCalendar: number;
  /* null when bookings can't be tied to channels yet. */
  bookings: number | null;
  bookingRate: number | null;
}

/*
  Bookings per channel come from booking_completed in PostHog, which carries the
  visit's source. They're only shown once GHL is connected and that event has been
  seen, otherwise the table ranks by "Reached calendar".
*/
export const channelBookingsAvailable = (b: BookingData, ghl: GhlState) => ghl.state === "ok" && b.completionTracked;

export function channelRows(b: BookingData, ghl: GhlState): ChannelRow[] {
  const withBookings = channelBookingsAvailable(b, ghl);
  return channelTotals(b.sources)
    .map((t) => ({
      key: t.key,
      label: channelLabels[t.key],
      visits: t.visits,
      reachedCalendar: t.reachedCalendar,
      bookings: withBookings ? t.booked : null,
      bookingRate: withBookings ? share(t.booked, t.visits) : null,
    }))
    .sort((a, b) =>
      withBookings
        ? b.bookings! - a.bookings! || b.reachedCalendar - a.reachedCalendar || b.visits - a.visits
        : b.reachedCalendar - a.reachedCalendar || b.visits - a.visits,
    );
}

export interface ProgrammeJourney {
  key: string;
  label: string;
  ctaClicks: number;
  reachedCalendar: number;
  booked: number | null;
}

export function programmeJourneys(b: BookingData, ghl: GhlState): ProgrammeJourney[] {
  const sum = (record: Record<string, number>, keys: string[]) => keys.reduce((s, k) => s + (record[k] ?? 0), 0);
  return programmes.map((p) => ({
    key: p.key,
    label: p.label,
    ctaClicks: b.ctaClicks[p.key] ?? 0,
    reachedCalendar: sum(b.calendarsReached, p.calendars),
    booked: ghl.state === "ok" ? sum(ghl.data.byCalendar, p.calendars) : null,
  }));
}
