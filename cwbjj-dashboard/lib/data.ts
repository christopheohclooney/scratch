import { unstable_cache } from "next/cache";
import { periodsFor } from "./period";
import { mockBookings, mockGhl, mockSite } from "./sources/mock";
import { fetchBookings, fetchSite, posthogConfigured } from "./sources/posthog";
import { fetchGhl, ghlConfigured } from "./sources/ghl";
import type { DashboardData, GhlState, Loaded, Periods, Range } from "./types";

/* Data is cached for an hour, so the dashboard loads instantly and the APIs aren't hammered. */
const CACHE_SECONDS = 3600;

export const useMockData = () => process.env.USE_MOCK_DATA === "1";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* Errors are thrown out of the cache, so a failed call is retried next time instead of being kept for an hour. */
async function settle<T>(load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (e) {
    console.error(e);
    return { ok: false, error: message(e) };
  }
}

const cached = <T>(name: string, load: (p: Periods) => Promise<T>) =>
  unstable_cache(
    async (p: Periods) => ({ data: await load(p), fetchedAt: new Date().toISOString() }),
    [`cwbjj-${name}`],
    { revalidate: CACHE_SECONDS },
  );

const cachedSite = cached("site", fetchSite);
const cachedBookings = cached("bookings", fetchBookings);
const cachedGhl = cached("ghl", fetchGhl);

const notConnected = (what: string) => async (): Promise<never> => {
  throw new Error(`${what} isn't connected yet. Add its keys in Vercel (see the README).`);
};

export async function loadDashboard(range: Range, options: { mockGhlOff?: boolean } = {}): Promise<DashboardData> {
  const periods = periodsFor(range);

  if (useMockData()) {
    return {
      range,
      periods,
      site: { ok: true, data: mockSite(periods) },
      bookings: { ok: true, data: mockBookings(periods, range) },
      ghl: options.mockGhlOff ? { state: "missing" } : { state: "ok", data: mockGhl(range) },
      updatedAt: new Date().toISOString(),
      mock: true,
    };
  }

  const fetchedAt: string[] = [];
  const track = <T>(r: { data: T; fetchedAt: string }) => {
    fetchedAt.push(r.fetchedAt);
    return r.data;
  };

  const [site, bookings, ghlResult] = await Promise.all([
    settle(posthogConfigured() ? async () => track(await cachedSite(periods)) : notConnected("PostHog")),
    settle(posthogConfigured() ? async () => track(await cachedBookings(periods)) : notConnected("PostHog")),
    ghlConfigured() ? settle(async () => track(await cachedGhl(periods))) : null,
  ]);

  const ghl: GhlState = !ghlResult
    ? { state: "missing" }
    : ghlResult.ok
      ? { state: "ok", data: ghlResult.data }
      : { state: "error", error: ghlResult.error };

  /* "Last updated" is the oldest cached piece on the page. */
  const updatedAt = fetchedAt.sort()[0] ?? new Date().toISOString();

  return { range, periods, site, bookings, ghl, updatedAt, mock: false };
}
