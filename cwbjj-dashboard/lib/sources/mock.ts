import type { SourceRow } from "../config/channels";
import { daysIn } from "../period";
import type { BookingData, GhlData, Periods, SiteData } from "../types";

/*
  Realistic made-up numbers for reviewing the layout before the real sources are
  connected. Seeded, so the same dates always give the same numbers.
*/

function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/* Busier on weekday evenings' run-up and Mondays, quieter at weekends. */
const weekdayShape = [0.8, 1.25, 1.1, 1.05, 1.0, 0.85, 0.7];

function dailyVisits(date: string, rand: () => number) {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return Math.round(165 * weekdayShape[dow] * (0.85 + rand() * 0.3));
}

export function mockSite(p: Periods): SiteData {
  const rand = seeded(`site:${p.current.from}`);
  const previousDays = daysIn(p.previous.from, p.previous.to);
  const daily = daysIn(p.current.from, p.current.to).map((date, i) => ({
    date,
    current: dailyVisits(date, rand),
    previous: Math.round(dailyVisits(previousDays[i], rand) * 0.86),
  }));
  const visits = daily.reduce((s, d) => s + d.current, 0);
  const previousVisits = daily.reduce((s, d) => s + d.previous, 0);
  const scale = visits / 1240;

  const pages: [string, number, number][] = [
    ["/", 0.62, 48],
    ["/classes", 0.31, 41],
    ["/book", 0.22, 96],
    ["/schedule", 0.2, 37],
    ["/classes/beginners", 0.16, 52],
    ["/membership", 0.14, 44],
    ["/classes/kids-teens", 0.12, 49],
    ["/classes/gi", 0.09, 39],
    ["/classes/no-gi", 0.08, 36],
    ["/about", 0.07, 31],
    ["/classes/striking", 0.06, 34],
    ["/support", 0.02, 22],
  ];

  return {
    totals: {
      current: { visits, pageviews: Math.round(visits * 2.4), bounceRate: 0.46, avgVisitSeconds: 112 },
      previous: { visits: previousVisits, pageviews: Math.round(previousVisits * 2.3), bounceRate: 0.49, avgVisitSeconds: 104 },
    },
    daily,
    topPages: pages.map(([path, share, seconds]) => ({
      path,
      visits: Math.round(1240 * scale * share),
      avgSeconds: seconds,
    })),
    devices: { mobile: Math.round(visits * 0.71), desktop: visits - Math.round(visits * 0.71) },
  };
}

export function mockBookings(p: Periods, days: number): BookingData {
  const k = days / 7;
  const r = (n: number) => Math.round(n * k);
  const sources: SourceRow[] = [
    { referringDomain: "l.instagram.com", utmSource: "instagram", utmMedium: "social", inApp: "instagram", visits: r(410), reachedCalendar: r(36), booked: r(5) },
    { referringDomain: "instagram.com", utmSource: null, utmMedium: null, inApp: "instagram", visits: r(120), reachedCalendar: r(9), booked: r(2) },
    { referringDomain: "l.facebook.com", utmSource: "facebook", utmMedium: "paid", inApp: "facebook", visits: r(150), reachedCalendar: r(12), booked: r(2) },
    { referringDomain: "l.facebook.com", utmSource: "facebook", utmMedium: "social", inApp: "facebook", visits: r(70), reachedCalendar: r(4), booked: r(1) },
    { referringDomain: "www.google.com", utmSource: null, utmMedium: null, inApp: null, visits: r(260), reachedCalendar: r(17), booked: r(3) },
    { referringDomain: "$direct", utmSource: null, utmMedium: null, inApp: null, visits: r(190), reachedCalendar: r(9), booked: r(1) },
    { referringDomain: "www.bjjglobetrotters.com", utmSource: null, utmMedium: null, inApp: null, visits: r(40), reachedCalendar: r(3), booked: 0 },
  ];
  /* Last period: less Instagram, a little more Google, so the comparisons have something to show. */
  const previousShare = [0.72, 0.8, 0.9, 1.1, 1.15, 0.95, 1];
  const previousSources = sources.map((s, i) => ({
    ...s,
    visits: Math.round(s.visits * previousShare[i]),
    reachedCalendar: Math.round(s.reachedCalendar * previousShare[i]),
    booked: Math.round(s.booked * previousShare[i]),
  }));
  return {
    funnel: {
      current: { opened: r(268), audience: r(214), programme: r(141), calendar: r(90), completed: r(14) },
      previous: { opened: r(231), audience: r(180), programme: r(122), calendar: r(74), completed: r(10) },
    },
    sources,
    previousSources,
    completionTracked: true,
    ctaClicks: { beginners: r(58), gi: r(21), "no-gi": r(17), striking: r(14), "kids-teens": r(33) },
    calendarsReached: {
      "adult-beginners": r(34),
      gi: r(11),
      "no-gi": r(10),
      "adult-striking": r(8),
      "kids-4-5": r(7),
      "kids-6-11": r(13),
      "teens-12-15": r(7),
    },
  };
}

export function mockGhl(days: number): GhlData {
  const k = days / 7;
  const byCalendar: Record<string, number> = {
    "adult-beginners": 6,
    gi: 2,
    "no-gi": 1,
    "adult-striking": 1,
    "kids-4-5": 1,
    "kids-6-11": 2,
    "teens-12-15": 1,
  };
  for (const key of Object.keys(byCalendar)) byCalendar[key] = Math.round(byCalendar[key] * k);
  const current = Object.values(byCalendar).reduce((s, n) => s + n, 0);
  return { current, previous: Math.round(current * 0.79), byCalendar };
}
