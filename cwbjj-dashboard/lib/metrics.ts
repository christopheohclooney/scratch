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
  /* The same share for the previous period, for the comparison marker. */
  previousOfOpened: number | null;
}

type StepCounts = Record<StepKey, number | null>;

const stepCounts = (c: FunnelCounts, booked: number | null): StepCounts => ({
  opened: c.opened,
  audience: c.audience,
  programme: c.programme,
  calendar: c.calendar,
  completed: null,
  booked,
});

const stepDefs: [StepKey, string, string][] = [
  ["opened", "Opened the booking page", "booking page"],
  ["audience", "Chose Adult or Child", "Adult or Child step"],
  ["programme", "Chose a programme", "programme step"],
  ["calendar", "Saw the calendar", "calendar"],
  ["booked", "Booked and paid", "booking and payment step"],
];

/*
  The five funnel steps. Booked comes from GHL, so it's null until GHL is connected.
  Pass the previous period's counts to get the comparison markers.
*/
export function funnelSteps(
  counts: FunnelCounts,
  ghl: GhlState,
  previous?: FunnelCounts,
): FunnelStep[] {
  const ok = ghl.state === "ok";
  const now = stepCounts(counts, ok ? ghl.data.current : null);
  const before = previous ? stepCounts(previous, ok ? ghl.data.previous : null) : null;
  return stepDefs.map(([key, label, stepName], i) => {
    const count = now[key];
    const prior = i > 0 ? now[stepDefs[i - 1][0]] : null;
    const previousCount = before?.[key] ?? null;
    return {
      key,
      label,
      stepName,
      count,
      ofOpened: count === null ? null : share(count, counts.opened),
      dropped: count === null || prior === null ? null : Math.max(0, prior - count),
      previousOfOpened: previousCount === null || !previous ? null : share(previousCount, previous.opened),
    };
  });
}

/*
  A plain suggestion for the step where most people leave. Fixed wording per step,
  not generated, so João sees the same advice for the same situation.
*/
export const dropAdvice: Record<StepKey, string> = {
  opened: "",
  audience:
    "People are leaving before choosing Adult or Child. Check the booking page loads quickly on phones and that the first question is easy to see.",
  programme:
    "Many people stop at choosing a programme. Clearer class descriptions, or better “Which programme is right for me?” text, may help.",
  calendar:
    "People choose a programme but leave before the calendar appears. The calendar can be slow on phones, so it's worth testing on mobile data.",
  completed: "",
  booked:
    "Most people who see a calendar don't book. Check the class times on offer suit people, and that the trial price is clear before they reach payment.",
};

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
  /* The ranking number (bookings, or reached calendar) for the previous period. */
  previous: number;
}

/*
  Bookings per channel come from booking_completed in PostHog, which carries the
  visit's source. They're only shown once GHL is connected and that event has been
  seen, otherwise the table ranks by "Reached calendar".
*/
export const channelBookingsAvailable = (b: BookingData, ghl: GhlState) => ghl.state === "ok" && b.completionTracked;

/* Ranked by bookings when available, otherwise by reached calendar. "Other" always goes last. */
export function channelRows(b: BookingData, ghl: GhlState): ChannelRow[] {
  const withBookings = channelBookingsAvailable(b, ghl);
  const before = new Map(channelTotals(b.previousSources).map((t) => [t.key, t]));
  const rank = (r: ChannelRow) => (withBookings ? r.bookings! : r.reachedCalendar);
  return channelTotals(b.sources)
    .map((t) => {
      const prev = before.get(t.key);
      return {
        key: t.key,
        label: channelLabels[t.key],
        visits: t.visits,
        reachedCalendar: t.reachedCalendar,
        bookings: withBookings ? t.booked : null,
        bookingRate: withBookings ? share(t.booked, t.visits) : null,
        previous: (withBookings ? prev?.booked : prev?.reachedCalendar) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        Number(a.key === "other") - Number(b.key === "other") ||
        rank(b) - rank(a) ||
        b.reachedCalendar - a.reachedCalendar ||
        b.visits - a.visits,
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
