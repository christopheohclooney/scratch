import type { Periods, Range } from "./types";

export const timeZone = "Europe/London";

/* Today's date in London as YYYY-MM-DD. */
export function londonDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/*
  Whole London days ending yesterday, so a period is never cut short by today.
  "Last 7 days" on a Monday is the previous Monday to Sunday.
*/
export function periodsFor(range: Range, now = new Date()): Periods {
  const to = addDays(londonDate(now), -1);
  const from = addDays(to, -(range - 1));
  return {
    current: { from, to },
    previous: { from: addDays(from, -range), to: addDays(from, -1) },
  };
}

export function daysIn(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}
