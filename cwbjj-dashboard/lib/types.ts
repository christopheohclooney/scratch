import type { SourceRow } from "./config/channels";

export type Range = 7 | 30;

export const parseRange = (value: unknown): Range => (value === "30" ? 30 : 7);

/* A section's data, or the reason it couldn't load. Lets one section fail without the rest. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PeriodTotals {
  visits: number;
  pageviews: number;
  /* Share of visits that saw one page and did nothing else, 0 to 1. */
  bounceRate: number | null;
  avgVisitSeconds: number | null;
}

export interface SiteData {
  totals: { current: PeriodTotals; previous: PeriodTotals };
  /* One entry per day of the current period, with the matching day of the previous period. */
  daily: { date: string; current: number; previous: number }[];
  topPages: { path: string; visits: number; avgSeconds: number | null }[];
  devices: { mobile: number; desktop: number };
}

/* Visits that reached each step of the booking form. */
export interface FunnelCounts {
  opened: number;
  audience: number;
  programme: number;
  calendar: number;
  /* Visits where GHL told the form a booking finished (booking_completed). */
  completed: number;
}

export interface BookingData {
  funnel: { current: FunnelCounts; previous: FunnelCounts };
  sources: SourceRow[];
  /* True once booking_completed has been seen, meaning bookings can be tied to a channel. */
  completionTracked: boolean;
  ctaClicks: Record<string, number>;
  calendarsReached: Record<string, number>;
}

export interface GhlData {
  current: number;
  previous: number;
  byCalendar: Record<string, number>;
}

/* GHL stays "missing" until its token is added, which the UI shows as "Not connected yet". */
export type GhlState = { state: "missing" } | { state: "error"; error: string } | { state: "ok"; data: GhlData };

export interface DashboardData {
  range: Range;
  periods: Periods;
  site: Loaded<SiteData>;
  bookings: Loaded<BookingData>;
  ghl: GhlState;
  updatedAt: string;
  mock: boolean;
}

export interface Period {
  from: string;
  to: string;
}

export interface Periods {
  current: Period;
  previous: Period;
}
