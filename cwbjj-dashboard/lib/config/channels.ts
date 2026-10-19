import { siteDomain } from "./site";

export type ChannelKey =
  | "instagram"
  | "instagram-organic"
  | "instagram-paid"
  | "facebook"
  | "facebook-organic"
  | "facebook-paid"
  | "google"
  | "direct"
  | "other";

export const channelLabels: Record<ChannelKey, string> = {
  instagram: "Instagram",
  "instagram-organic": "Instagram",
  "instagram-paid": "Instagram ads",
  facebook: "Facebook",
  "facebook-organic": "Facebook",
  "facebook-paid": "Facebook ads",
  google: "Google search",
  direct: "Direct",
  other: "Other",
};

/* One group of visits that share where they came from, as returned by PostHog. */
export interface SourceRow {
  referringDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  /* "instagram" or "facebook" when the visit came from that app's in-app browser. */
  inApp: string | null;
  visits: number;
  reachedCalendar: number;
  booked: number;
}

const paidMediums = new Set(["paid", "cpc", "ppc", "paid_social", "paidsocial", "ads"]);

const clean = (s: string | null) => (s ?? "").trim().toLowerCase().replace(/^\$direct$/, "");

const domainIs = (domain: string, ...names: string[]) =>
  names.some((n) => domain === n || domain.endsWith(`.${n}`));

/* Groups one source row into a channel. Paid Instagram and Facebook are kept apart for now. */
export function classify(row: Pick<SourceRow, "referringDomain" | "utmSource" | "utmMedium" | "inApp">): {
  channel: "instagram" | "facebook" | "google" | "direct" | "other";
  paid: boolean;
} {
  const domain = clean(row.referringDomain);
  const source = clean(row.utmSource);
  const paid = paidMediums.has(clean(row.utmMedium));
  const inApp = clean(row.inApp);

  if (source === "instagram" || source === "ig" || inApp === "instagram" || domainIs(domain, "instagram.com"))
    return { channel: "instagram", paid };
  if (source === "facebook" || source === "fb" || inApp === "facebook" || domainIs(domain, "facebook.com", "fb.com", "fb.me"))
    return { channel: "facebook", paid };
  if (source === "google" || /(^|\.)google\.[a-z.]+$/.test(domain)) return { channel: "google", paid };
  if (source === "" && (domain === "" || domainIs(domain, siteDomain))) return { channel: "direct", paid: false };
  return { channel: "other", paid };
}

export interface ChannelTotals {
  key: ChannelKey;
  visits: number;
  reachedCalendar: number;
  booked: number;
}

/*
  Totals per channel. Instagram and Facebook are split into organic and ads rows
  only when some of their traffic is tagged as paid.
*/
export function channelTotals(rows: SourceRow[]): ChannelTotals[] {
  const grouped = rows.map((r) => ({ ...classify(r), row: r }));
  const hasPaid = grouped.some((g) => g.paid && (g.channel === "instagram" || g.channel === "facebook"));
  const totals = new Map<ChannelKey, ChannelTotals>();
  for (const { channel, paid, row } of grouped) {
    const key: ChannelKey =
      hasPaid && (channel === "instagram" || channel === "facebook") ? `${channel}-${paid ? "paid" : "organic"}` : channel;
    const t = totals.get(key) ?? { key, visits: 0, reachedCalendar: 0, booked: 0 };
    t.visits += row.visits;
    t.reachedCalendar += row.reachedCalendar;
    t.booked += row.booked;
    totals.set(key, t);
  }
  return [...totals.values()];
}
