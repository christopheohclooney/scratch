import Link from "next/link";
import { change, formatDate, periodWords } from "@/lib/format";
import type { Periods, Range } from "@/lib/types";

export type RangeLinks = Record<Range, string>;

/* The date range switch: one track, the selected option as a solid pill. */
export function RangeToggle({ range, links }: { range: Range; links: RangeLinks }) {
  return (
    <nav className="range-toggle" aria-label="Date range">
      {([7, 30] as const).map((r) => (
        <Link key={r} href={links[r]} aria-current={range === r ? "page" : undefined}>
          {r} days
        </Link>
      ))}
    </nav>
  );
}

/* Each tab's intro: heading and period on the left, the date range switch on the right. */
export function IntroHeader({
  line1,
  line2,
  periods,
  range,
  rangeLinks,
  children,
}: {
  line1: string;
  line2: string;
  periods: Periods;
  range: Range;
  rangeLinks: RangeLinks;
  children?: React.ReactNode;
}) {
  return (
    <div className="intro">
      <div className="intro__top">
        <div className="intro__title">
          <Heading line1={line1} line2={line2} />
          <PeriodLine periods={periods} range={range} />
        </div>
        <RangeToggle range={range} links={rangeLinks} />
      </div>
      {children}
    </div>
  );
}

export function Heading({ line1, line2 }: { line1: string; line2: string }) {
  return (
    <h1 className="heading">
      <span>{line1}</span>
      <span>{line2}</span>
    </h1>
  );
}

/*
  The plain-English summary at the top of each tab. At most two lines, so it
  reads as a headline rather than a report.
*/
export const SUMMARY_LINES = 2;

export function Summary({ lines }: { lines: (string | null)[] }) {
  const shown = lines.filter((l): l is string => Boolean(l)).slice(0, SUMMARY_LINES);
  if (shown.length === 0) return null;
  return (
    <ul className="insights">
      {shown.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

/* The period in words, under each tab's heading, so it's never mistaken. */
export function PeriodLine({ periods, range }: { periods: Periods; range: Range }) {
  return (
    <p className="period mono">
      {formatDate(periods.current.from)} to {formatDate(periods.current.to)}
      <span className="period__vs">
        {" "}
        · compared with {range === 7 ? "the week before" : "the 30 days before"}
      </span>
    </p>
  );
}

/* Section titles are the questions João asks; the note says how to read the answer. */
export function SectionHead({ eyebrow, title, note }: { eyebrow: string; title: string; note?: React.ReactNode }) {
  return (
    <div className="section__head">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="section__title">{title}</h2>
      {note ? <p className="section__note">{note}</p> : null}
    </div>
  );
}

/*
  Up or down arrow and percentage against the previous period. Green means
  better, red means worse; for bounce rate, down is better.
*/
export function Delta({
  current,
  previous,
  range,
  higherIsBetter = true,
  short = false,
}: {
  current: number | null;
  previous: number | null;
  range: Range;
  higherIsBetter?: boolean;
  /* Arrow and percentage only, for table cells. */
  short?: boolean;
}) {
  const words = periodWords(range);
  const delta = change(current, previous);
  if (current === 0 && previous === 0) return <span className="delta">{short ? "–" : `None ${words.previous} either`}</span>;
  if (delta === null) return <span className="delta">{short ? "New" : `Nothing ${words.previous} to compare`}</span>;
  const pct = Math.round(Math.abs(delta) * 100);
  if (pct === 0) return <span className="delta">{short ? "Same" : `Same as ${words.previous}`}</span>;
  const up = delta > 0;
  const good = up === higherIsBetter;
  return (
    <span className={`delta ${good ? "delta--good" : "delta--bad"}`}>
      <span className="delta__change">
        <span aria-hidden="true">{up ? "▲" : "▼"}</span> {short ? "" : up ? "Up " : "Down "}
        {pct}%
      </span>
      {short ? null : <span>vs {words.previous}</span>}
    </span>
  );
}

/* The one big number a tab leads with. */
export function HeroStat({
  label,
  value,
  delta,
  detail,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="hero">
      <span className="hero__label">{label}</span>
      <span className="hero__value">{value}</span>
      {delta}
      {detail ? <p className="hero__detail">{detail}</p> : null}
    </div>
  );
}

/* Supporting figures, quieter than the hero, in one strip. */
export function MiniStats({ children }: { children: React.ReactNode }) {
  return <div className="card mini-stats">{children}</div>;
}

export function MiniStat({
  label,
  value,
  delta,
  children,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mini-stat">
      <span className="mini-stat__label">{label}</span>
      <span className="mini-stat__value">{value}</span>
      <span className="mini-stat__extra">{delta ?? children}</span>
    </div>
  );
}

/* "What these numbers mean": definitions for someone opening the dashboard after a few weeks away. */
export function Guide({ items }: { items: [string, string][] }) {
  return (
    <details className="guide">
      <summary>What these numbers mean</summary>
      <dl>
        {items.map(([term, meaning]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function SectionError({ what, error }: { what: string; error: string }) {
  return (
    <div className="section-error" role="status">
      Couldn't load {what} right now. The rest of the page is unaffected.
      <p>{error}</p>
    </div>
  );
}

export const NOT_CONNECTED = "Not connected yet";

export const definitions = {
  visit:
    "One visit to the site, from arriving to leaving. Tracking is cookieless, so nothing is stored on people's phones; the trade-off is that someone who comes back another day counts as a new visit.",
  bounce: "Visits that saw one page and did nothing else.",
  timeOnSite: "From the first page to the last one in a visit.",
  bookingRate: "Trial bookings out of the people who opened the booking page.",
  trialBooking: "A booking on one of the seven trial calendars in GoHighLevel. Cancelled bookings aren't counted; no-shows are, because they booked and paid.",
  channel:
    "Where a visit first came from: Instagram, Facebook, Google search, Direct (typed the address or used a bookmark) or Other. Ads show separately when your links are tagged as paid (see the link guide).",
  reachedCalendar: "Visits where a GoHighLevel booking calendar finished loading on the booking page.",
};
