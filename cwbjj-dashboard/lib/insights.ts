import { biggestDrop, channelBookingsAvailable, channelRows, funnelSteps, MIN_SAMPLE } from "./metrics";
import { change, formatNumber, formatPercent, periodWords, share } from "./format";
import type { BookingData, GhlState, Range, SiteData } from "./types";

/*
  Plain-English sentences built from fixed rules, never from an AI model.
  Booking-based sentences are left out until GHL is connected.
*/

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function bookingInsights(b: BookingData, ghl: GhlState, range: Range): string[] {
  const words = periodWords(range);
  const opened = b.funnel.current.opened;
  if (opened < MIN_SAMPLE) return [`Not enough data yet ${words.current}. Fewer than ${MIN_SAMPLE} people opened the booking page.`];

  const lines: string[] = [];
  const rows = channelRows(b, ghl);

  if (channelBookingsAvailable(b, ghl)) {
    const total = rows.reduce((s, r) => s + (r.bookings ?? 0), 0);
    const top = rows[0];
    if (total >= 3 && top?.bookings) {
      lines.push(`${top.label} brought in ${formatPercent(share(top.bookings, total))} of trial bookings ${words.current}.`);
    }
  } else {
    const total = rows.reduce((s, r) => s + r.reachedCalendar, 0);
    const top = rows[0];
    if (total >= MIN_SAMPLE && top?.reachedCalendar) {
      lines.push(
        `${top.label} brought ${formatPercent(share(top.reachedCalendar, total))} of the people who reached a calendar ${words.current}.`,
      );
    }
  }

  if (ghl.state === "ok") {
    const now = share(ghl.data.current, b.funnel.current.calendar);
    const before = share(ghl.data.previous, b.funnel.previous.calendar);
    if (now !== null && b.funnel.current.calendar >= MIN_SAMPLE) {
      const rate = Math.min(now, 1);
      const comparison =
        before === null || b.funnel.previous.calendar < MIN_SAMPLE
          ? ""
          : Math.round(rate * 100) === Math.round(Math.min(before, 1) * 100)
            ? `, the same as ${words.previous}`
            : `, ${rate > before ? "up" : "down"} from ${formatPercent(Math.min(before, 1))} ${words.previous}`;
      lines.push(`${formatPercent(rate)} of people who saw a calendar went on to book${comparison}.`);
    }
  }

  const drop = biggestDrop(funnelSteps(b.funnel.current, ghl, ghl.state === "ok" ? ghl.data.current : undefined));
  if (drop) lines.push(`Most people leave at the ${drop.stepName}.`);

  return lines;
}

export function siteSummary(site: SiteData, range: Range): string {
  const words = periodWords(range);
  const { current, previous } = site.totals;
  const visits = `${formatNumber(current.visits)} ${current.visits === 1 ? "visit" : "visits"} to the site ${words.current}`;
  const delta = change(current.visits, previous.visits);
  if (delta === null) return `${capitalise(visits)}.`;
  const pct = Math.round(Math.abs(delta) * 100);
  if (pct === 0) return `${capitalise(visits)}, about the same as ${words.previous}.`;
  return `${capitalise(visits)}, ${delta > 0 ? "up" : "down"} ${pct}% on ${words.previous}.`;
}
