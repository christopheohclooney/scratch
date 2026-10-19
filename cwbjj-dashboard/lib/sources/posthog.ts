import type { SourceRow } from "../config/channels";
import { normalisePath } from "../config/site";
import { daysIn, timeZone } from "../period";
import type { BookingData, FunnelCounts, PeriodTotals, Periods, SiteData } from "../types";

/*
  Reads the site and booking form events from PostHog with HogQL, through
  POST /api/projects/:id/query. Needs a personal API key with "Query: read".
  A "visit" is one PostHog session: the tracking is cookieless, so a returning
  visitor starts a new visit.
*/

export const posthogConfigured = () => Boolean(process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID);

type Row = unknown[];

async function hogql(query: string): Promise<Row[]> {
  const host = (process.env.POSTHOG_HOST ?? "https://eu.posthog.com").replace(/\/+$/, "");
  const res = await fetch(`${host}/api/projects/${process.env.POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PostHog returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { results?: Row[] };
  return json.results ?? [];
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

/* Dates come from our own period maths (YYYY-MM-DD), never from a request, so inlining them is safe. */
const day = `toDate(toTimeZone(timestamp, '${timeZone}'))`;
const between = (from: string, to: string) => `${day} >= toDate('${from}') AND ${day} <= toDate('${to}')`;
const hasSession = `$session_id IS NOT NULL AND $session_id != ''`;

/* Per-visit summary used by several queries. */
const visitsSubquery = (p: Periods, extra = "") => `
  SELECT
    $session_id AS sid,
    if(min(${day}) >= toDate('${p.current.from}'), 'current', 'previous') AS period,
    min(${day}) AS first_day,
    countIf(event = '$pageview') AS pageviews,
    countIf(startsWith(event, 'booking_')) AS booking_events,
    dateDiff('second', min(timestamp), max(timestamp)) AS seconds,
    countIf(event = 'booking_form_viewed') AS opened,
    countIf(event = 'booking_audience_selected') AS audience,
    countIf(event = 'booking_programme_selected') AS programme,
    countIf(event = 'booking_calendar_loaded') AS calendar,
    countIf(event = 'booking_completed') AS completed
    ${extra}
  FROM events
  WHERE ${between(p.previous.from, p.current.to)} AND ${hasSession}
  GROUP BY sid`;

const emptyTotals = (): PeriodTotals => ({ visits: 0, pageviews: 0, bounceRate: null, avgVisitSeconds: null });

export async function fetchSite(p: Periods): Promise<SiteData> {
  const [totalsRows, dailyRows, pageRows, timeRows, deviceRows] = await Promise.all([
    hogql(`
      SELECT period, count(), sum(pageviews),
        countIf(pageviews = 1 AND booking_events = 0) / count(),
        avg(seconds)
      FROM (${visitsSubquery(p)})
      WHERE pageviews > 0
      GROUP BY period`),
    hogql(`
      SELECT first_day, count()
      FROM (${visitsSubquery(p)})
      WHERE pageviews > 0
      GROUP BY first_day`),
    hogql(`
      SELECT properties.$pathname, count(DISTINCT $session_id)
      FROM events
      WHERE event = '$pageview' AND ${between(p.current.from, p.current.to)} AND ${hasSession}
      GROUP BY properties.$pathname
      ORDER BY 2 DESC
      LIMIT 100`),
    hogql(`
      SELECT properties.$prev_pageview_pathname, avg(toFloat(properties.$prev_pageview_duration))
      FROM events
      WHERE event IN ('$pageview', '$pageleave')
        AND properties.$prev_pageview_duration IS NOT NULL
        AND ${between(p.current.from, p.current.to)}
      GROUP BY properties.$prev_pageview_pathname`),
    hogql(`
      SELECT device, count()
      FROM (
        SELECT $session_id AS sid, argMin(properties.$device_type, timestamp) AS device
        FROM events
        WHERE event = '$pageview' AND ${between(p.current.from, p.current.to)} AND ${hasSession}
        GROUP BY sid
      )
      GROUP BY device`),
  ]);

  const totals = { current: emptyTotals(), previous: emptyTotals() };
  for (const [period, visits, pageviews, bounce, seconds] of totalsRows) {
    const t = period === "current" ? totals.current : totals.previous;
    t.visits = num(visits);
    t.pageviews = num(pageviews);
    t.bounceRate = t.visits ? num(bounce) : null;
    t.avgVisitSeconds = t.visits ? num(seconds) : null;
  }

  const visitsByDay = new Map(dailyRows.map(([d, n]) => [String(d), num(n)]));
  const previousDays = daysIn(p.previous.from, p.previous.to);
  const daily = daysIn(p.current.from, p.current.to).map((date, i) => ({
    date,
    current: visitsByDay.get(date) ?? 0,
    previous: visitsByDay.get(previousDays[i]) ?? 0,
  }));

  /* Paths with and without a trailing slash are the same page. */
  const pages = new Map<string, number>();
  for (const [path, visits] of pageRows) {
    const key = normalisePath(String(path ?? "/"));
    pages.set(key, (pages.get(key) ?? 0) + num(visits));
  }
  const times = new Map<string, { total: number; n: number }>();
  for (const [path, seconds] of timeRows) {
    const key = normalisePath(String(path ?? "/"));
    const t = times.get(key) ?? { total: 0, n: 0 };
    t.total += num(seconds);
    t.n += 1;
    times.set(key, t);
  }
  const topPages = [...pages.entries()]
    .map(([path, visits]) => {
      const t = times.get(path);
      return { path, visits, avgSeconds: t ? t.total / t.n : null };
    })
    .sort((a, b) => b.visits - a.visits);

  const devices = { mobile: 0, desktop: 0 };
  for (const [device, n] of deviceRows) {
    if (device === "Desktop") devices.desktop += num(n);
    else devices.mobile += num(n);
  }

  return { totals, daily, topPages, devices };
}

const emptyFunnel = (): FunnelCounts => ({ opened: 0, audience: 0, programme: 0, calendar: 0, completed: 0 });

const inAppBrowser = `multiIf(
  properties.$raw_user_agent ILIKE '%Instagram%', 'instagram',
  properties.$raw_user_agent ILIKE '%FBAN%' OR properties.$raw_user_agent ILIKE '%FBAV%', 'facebook',
  '')`;

export async function fetchBookings(p: Periods): Promise<BookingData> {
  const [funnelRows, sourceRows, programmeRows, completedRows] = await Promise.all([
    /* Each step counts visits that also reached every earlier step. */
    hogql(`
      SELECT period,
        countIf(opened > 0),
        countIf(opened > 0 AND audience > 0),
        countIf(opened > 0 AND audience > 0 AND programme > 0),
        countIf(opened > 0 AND audience > 0 AND programme > 0 AND calendar > 0),
        countIf(opened > 0 AND audience > 0 AND programme > 0 AND calendar > 0 AND completed > 0)
      FROM (${visitsSubquery(p)})
      GROUP BY period`),
    /* Where each visit came from, read from its first page view. */
    hogql(`
      SELECT period, ref, src, med, in_app, count(), countIf(calendar > 0), countIf(completed > 0)
      FROM (${visitsSubquery(
        p,
        `,
        argMinIf(properties.$referring_domain, timestamp, event = '$pageview') AS ref,
        argMinIf(properties.utm_source, timestamp, event = '$pageview') AS src,
        argMinIf(properties.utm_medium, timestamp, event = '$pageview') AS med,
        argMinIf(${inAppBrowser}, timestamp, event = '$pageview') AS in_app`,
      )})
      WHERE pageviews > 0
      GROUP BY period, ref, src, med, in_app`),
    hogql(`
      SELECT event, properties.programme, count(DISTINCT $session_id)
      FROM events
      WHERE event IN ('cta_clicked', 'booking_calendar_loaded')
        AND ${between(p.current.from, p.current.to)} AND ${hasSession}
      GROUP BY event, properties.programme`),
    hogql(`
      SELECT count()
      FROM events
      WHERE event = 'booking_completed' AND timestamp > now() - INTERVAL 90 DAY`),
  ]);

  const funnel = { current: emptyFunnel(), previous: emptyFunnel() };
  for (const [period, opened, audience, programme, calendar, completed] of funnelRows) {
    funnel[period === "current" ? "current" : "previous"] = {
      opened: num(opened),
      audience: num(audience),
      programme: num(programme),
      calendar: num(calendar),
      completed: num(completed),
    };
  }

  const sources: SourceRow[] = [];
  const previousSources: SourceRow[] = [];
  for (const [period, ref, src, med, inApp, visits, cal, done] of sourceRows) {
    (period === "current" ? sources : previousSources).push({
      referringDomain: str(ref),
      utmSource: str(src),
      utmMedium: str(med),
      inApp: str(inApp),
      visits: num(visits),
      reachedCalendar: num(cal),
      booked: num(done),
    });
  }

  const ctaClicks: Record<string, number> = {};
  const calendarsReached: Record<string, number> = {};
  for (const [event, programme, n] of programmeRows) {
    const target = event === "cta_clicked" ? ctaClicks : calendarsReached;
    const key = String(programme ?? "");
    if (key) target[key] = (target[key] ?? 0) + num(n);
  }

  return {
    funnel,
    sources,
    previousSources,
    completionTracked: num(completedRows[0]?.[0]) > 0,
    ctaClicks,
    calendarsReached,
  };
}
