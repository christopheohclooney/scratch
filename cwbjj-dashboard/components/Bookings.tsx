import { formatNumber, formatPercent, periodWords, share } from "@/lib/format";
import { bookingInsights } from "@/lib/insights";
import {
  biggestDrop,
  channelBookingsAvailable,
  channelRows,
  dropAdvice,
  funnelSteps,
  programmeJourneys,
} from "@/lib/metrics";
import type { BookingData, GhlState, Loaded, Periods, Range } from "@/lib/types";
import {
  definitions,
  Delta,
  Guide,
  Heading,
  HeroStat,
  NOT_CONNECTED,
  PeriodLine,
  SectionError,
  SectionHead,
} from "./ui";

export function Bookings({
  bookings,
  ghl,
  range,
  periods,
}: {
  bookings: Loaded<BookingData>;
  ghl: GhlState;
  range: Range;
  periods: Periods;
}) {
  return (
    <>
      <div className="intro">
        <Heading line1="Bookings" line2="Where your trials come from." />
        <PeriodLine periods={periods} range={range} />
        {bookings.ok ? (
          <ul className="insights">
            {bookingInsights(bookings.data, ghl, range).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {ghl.state === "error" ? (
        <div className="stack-gap">
          <SectionError what="bookings from GoHighLevel" error={ghl.error} />
        </div>
      ) : null}

      {!bookings.ok ? (
        <SectionError what="the booking form numbers" error={bookings.error} />
      ) : (
        <BookingSections b={bookings.data} ghl={ghl} range={range} />
      )}

      <Guide
        items={[
          ["Trial booking", definitions.trialBooking],
          ["Booking rate", definitions.bookingRate],
          ["Reached a calendar", definitions.reachedCalendar],
          ["Channel", definitions.channel],
          ["Visit", definitions.visit],
        ]}
      />
    </>
  );
}

function BookingHero({ b, ghl, range }: { b: BookingData; ghl: GhlState; range: Range }) {
  const words = periodWords(range);
  const f = b.funnel;

  if (ghl.state === "ok") {
    const rateNow = share(ghl.data.current, f.current.opened);
    const rateBefore = share(ghl.data.previous, f.previous.opened);
    return (
      <HeroStat
        label="Trial bookings"
        value={formatNumber(ghl.data.current)}
        delta={<Delta current={ghl.data.current} previous={ghl.data.previous} range={range} />}
        detail={
          rateNow === null ? undefined : (
            <>
              That's <strong>{formatPercent(rateNow)}</strong> of the {formatNumber(f.current.opened)} people who opened the booking
              page{rateBefore === null ? "" : `, compared with ${formatPercent(rateBefore)} ${words.previous}`}.
            </>
          )
        }
      />
    );
  }

  /* Until GHL is connected, the furthest step we can see leads instead. */
  return (
    <HeroStat
      label="Reached a calendar"
      value={formatNumber(f.current.calendar)}
      delta={<Delta current={f.current.calendar} previous={f.previous.calendar} range={range} />}
      detail={
        ghl.state === "missing"
          ? "Trial bookings appear here once GoHighLevel is connected."
          : "Trial bookings couldn't be loaded from GoHighLevel, so this shows the people who reached a calendar."
      }
    />
  );
}

function BookingSections({ b, ghl, range }: { b: BookingData; ghl: GhlState; range: Range }) {
  const words = periodWords(range);
  const channels = channelRows(b, ghl);
  const withBookings = channelBookingsAvailable(b, ghl);
  const steps = funnelSteps(b.funnel.current, ghl, b.funnel.previous);
  const worst = biggestDrop(steps);
  const journeys = programmeJourneys(b, ghl);
  const rankLabel = withBookings ? "Bookings" : "Reached calendar";

  const channelNote = withBookings
    ? "Ranked by trial bookings. A visit's channel is where it first arrived from."
    : ghl.state === "ok"
      ? "Ranked by people who reached a calendar. Bookings per channel aren't available yet, because GoHighLevel doesn't tell the booking form when a booking finishes."
      : "Ranked by people who reached a calendar. Bookings per channel appear once GoHighLevel is connected.";

  return (
    <>
      <section className="card hero-card" aria-label="Trial bookings">
        <BookingHero b={b} ghl={ghl} range={range} />
      </section>

      <section className="section">
        <SectionHead
          eyebrow="Drop-off"
          title="Where do people give up?"
          note="Everyone who opened the booking page, and how far they got. The grey mark shows the same step last time."
        />
        <div className="card funnel">
          <div className="funnel__legend" aria-hidden="true">
            <span className="funnel__key funnel__key--now">{words.currentLabel}</span>
            <span className="funnel__key funnel__key--before">{words.previousLabel}</span>
          </div>
          {steps.map((s, i) => (
            <div className={s === worst ? "funnel__row funnel__row--worst" : "funnel__row"} key={s.key}>
              <div className="funnel__top">
                <span>
                  <span className="mono cell-muted">{i + 1}&nbsp;&nbsp;</span>
                  {s.label}
                </span>
                <span className="funnel__figures mono">
                  {s.count === null ? (
                    <span className="not-connected">{ghl.state === "missing" ? NOT_CONNECTED : "–"}</span>
                  ) : (
                    <>
                      {formatNumber(s.count)} <span className="cell-muted">· {formatPercent(s.ofOpened)}</span>
                    </>
                  )}
                </span>
              </div>
              <div
                className="funnel__track"
                role="img"
                aria-label={
                  s.ofOpened === null
                    ? `${s.label}: not available`
                    : `${s.label}: ${formatPercent(s.ofOpened)}${
                        s.previousOfOpened === null ? "" : `, ${formatPercent(s.previousOfOpened)} ${words.previous}`
                      }`
                }
              >
                {s.ofOpened !== null ? (
                  <div className="funnel__bar" style={{ width: `${Math.min(1, s.ofOpened) * 100}%` }} />
                ) : null}
                {s.ofOpened !== null && s.previousOfOpened !== null && i > 0 ? (
                  <div className="funnel__prev" style={{ left: `${Math.min(1, s.previousOfOpened) * 100}%` }} />
                ) : null}
              </div>
              {s.dropped !== null && i > 0 ? (
                <span className={s === worst ? "funnel__drop funnel__drop--biggest" : "funnel__drop"}>
                  {s === worst ? "Biggest drop: " : ""}
                  {formatNumber(s.dropped)} left before this step
                </span>
              ) : null}
              {s === worst && dropAdvice[s.key] ? <p className="funnel__advice">{dropAdvice[s.key]}</p> : null}
              {s.key === "booked" && s !== worst ? (
                <p className="funnel__note">
                  This step covers choosing a time, entering details and paying, all inside GoHighLevel.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHead eyebrow="Channels" title="Where do trial bookings come from?" note={channelNote} />
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col">Visits</th>
                <th scope="col">Reached calendar</th>
                {withBookings ? (
                  <>
                    <th scope="col">Bookings</th>
                    <th scope="col">Booking rate</th>
                  </>
                ) : null}
                <th scope="col">
                  {rankLabel}
                  <span className="cell-sub">vs {words.previous}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 ? (
                <tr>
                  <td colSpan={withBookings ? 6 : 4} className="cell-muted">
                    No visits yet.
                  </td>
                </tr>
              ) : (
                channels.map((c) => (
                  <tr key={c.key}>
                    <td>{c.label}</td>
                    <td className="num">{formatNumber(c.visits)}</td>
                    <td className="num">{formatNumber(c.reachedCalendar)}</td>
                    {withBookings ? (
                      <>
                        <td className="num">{formatNumber(c.bookings ?? 0)}</td>
                        <td className="num">{formatPercent(c.bookingRate)}</td>
                      </>
                    ) : null}
                    <td className="num">
                      <Delta current={withBookings ? c.bookings : c.reachedCalendar} previous={c.previous} range={range} short />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <SectionHead
          eyebrow="Programmes"
          title="Which class pages lead to bookings?"
          note={`For each programme: clicks on “Book a trial” on its class page, then calendars reached${
            ghl.state === "ok" ? " and trial bookings" : " (bookings join in once GoHighLevel is connected)"
          }. People can also reach a calendar another way, so later numbers can be higher.`}
        />
        <div className="card journeys">
          {journeys.map((j) => (
            <div className="journey" key={j.key}>
              <span className="journey__name">
                {j.label}
                {j.key === "kids-teens" ? <span className="cell-sub">All three age groups</span> : null}
              </span>
              <span className="journey__path">
                <span>
                  <strong className="mono">{formatNumber(j.ctaClicks)}</strong> clicked
                </span>
                <span className="journey__arrow" aria-hidden="true">
                  →
                </span>
                <span>
                  <strong className="mono">{formatNumber(j.reachedCalendar)}</strong> saw calendar
                </span>
                {j.booked === null ? null : (
                  <>
                    <span className="journey__arrow" aria-hidden="true">
                      →
                    </span>
                    <span>
                      <strong className="mono">{formatNumber(j.booked)}</strong> booked
                    </span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
