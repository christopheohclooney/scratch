import { formatNumber, formatPercent, share } from "@/lib/format";
import { bookingInsights } from "@/lib/insights";
import {
  biggestDrop,
  channelBookingsAvailable,
  channelRows,
  funnelSteps,
  programmeJourneys,
} from "@/lib/metrics";
import type { BookingData, GhlState, Loaded, Range } from "@/lib/types";
import { Delta, Heading, NOT_CONNECTED, SectionError, SectionHead, Tile } from "./ui";

export function Bookings({ bookings, ghl, range }: { bookings: Loaded<BookingData>; ghl: GhlState; range: Range }) {
  return (
    <>
      <div className="intro">
        <Heading line1="Bookings" line2="Where your trials come from." />
        {bookings.ok ? (
          <ul className="insights">
            {bookingInsights(bookings.data, ghl, range).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {ghl.state === "error" ? (
        <div style={{ marginBottom: 16 }}>
          <SectionError what="bookings from GoHighLevel" error={ghl.error} />
        </div>
      ) : null}
      {!bookings.ok ? (
        <>
          <BookingTiles ghl={ghl} range={range} />
          <section className="section">
            <SectionError what="the booking form numbers" error={bookings.error} />
          </section>
        </>
      ) : (
        <BookingSections b={bookings.data} ghl={ghl} range={range} />
      )}
    </>
  );
}

const ghlValue = (ghl: GhlState, value: (d: { current: number; previous: number }) => string) =>
  ghl.state === "ok" ? value(ghl.data) : ghl.state === "missing" ? NOT_CONNECTED : "Couldn't load";

function BookingTiles({ b, ghl, range }: { b?: BookingData; ghl: GhlState; range: Range }) {
  const f = b?.funnel;
  const booked = ghl.state === "ok" ? ghl.data : null;
  const rateNow = booked && f ? share(booked.current, f.current.opened) : null;
  const rateBefore = booked && f ? share(booked.previous, f.previous.opened) : null;
  return (
    <div className="tiles">
      <Tile
        label="Opened the booking page"
        value={f ? formatNumber(f.current.opened) : "–"}
        delta={f ? <Delta current={f.current.opened} previous={f.previous.opened} range={range} /> : undefined}
      />
      <Tile
        label="Reached a calendar"
        value={f ? formatNumber(f.current.calendar) : "–"}
        delta={f ? <Delta current={f.current.calendar} previous={f.previous.calendar} range={range} /> : undefined}
      />
      <Tile
        label="Trial bookings"
        value={ghlValue(ghl, (d) => formatNumber(d.current))}
        muted={!booked}
        delta={booked ? <Delta current={booked.current} previous={booked.previous} range={range} /> : undefined}
        hint={booked ? "From GoHighLevel. Cancelled bookings aren't counted." : undefined}
      />
      <Tile
        label="Booking rate"
        value={booked ? formatPercent(rateNow) : ghlValue(ghl, () => "")}
        muted={!booked}
        delta={booked ? <Delta current={rateNow} previous={rateBefore} range={range} /> : undefined}
        hint={booked ? "Trial bookings out of people who opened the booking page." : undefined}
      />
    </div>
  );
}

function BookingSections({ b, ghl, range }: { b: BookingData; ghl: GhlState; range: Range }) {
  const channels = channelRows(b, ghl);
  const withBookings = channelBookingsAvailable(b, ghl);
  const steps = funnelSteps(b.funnel.current, ghl, ghl.state === "ok" ? ghl.data.current : undefined);
  const worst = biggestDrop(steps);
  const journeys = programmeJourneys(b, ghl);
  const bookedCell = (n: number | null) => (n === null ? <span className="not-connected">–</span> : formatNumber(n));
  /* With GHL missing, the bookings columns say so once in their header rather than in every cell. */
  const bookedHeader = (label: string, available: boolean) => (
    <th scope="col">
      {label}
      {!available ? (
        <span className="cell-sub">{ghl.state === "missing" ? NOT_CONNECTED : "Not available yet"}</span>
      ) : null}
    </th>
  );

  const channelNote = withBookings
    ? "Ranked by trial bookings. A visit's channel is where it first arrived from."
    : ghl.state === "ok"
      ? "Bookings per channel aren't available yet, because GoHighLevel isn't telling the booking form when a booking finishes. Ranked by people who reached a calendar."
      : "Ranked by people who reached a calendar. Bookings per channel appear once GoHighLevel is connected.";

  return (
    <>
      <BookingTiles b={b} ghl={ghl} range={range} />

      <section className="section">
        <SectionHead eyebrow="Channels" title="Leads by channel" note={channelNote} />
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col">Visits</th>
                <th scope="col">Reached calendar</th>
                {bookedHeader("Bookings", withBookings)}
                {bookedHeader("Booking rate", withBookings)}
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cell-muted">
                    No visits yet.
                  </td>
                </tr>
              ) : (
                channels.map((c) => (
                  <tr key={c.key}>
                    <td>{c.label}</td>
                    <td className="num">{formatNumber(c.visits)}</td>
                    <td className="num">{formatNumber(c.reachedCalendar)}</td>
                    <td className="num">{bookedCell(c.bookings)}</td>
                    <td className="num">
                      {c.bookingRate === null ? <span className="not-connected">–</span> : formatPercent(c.bookingRate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="split section">
        <section>
          <SectionHead
            eyebrow="Drop-off"
            title="Booking form drop-off"
            note="People who opened the booking page, and how far they got."
          />
          <div className="card funnel">
            {steps.map((s, i) => (
              <div className="funnel__row" key={s.key}>
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
                <div className="funnel__track" aria-hidden="true">
                  {s.count !== null && s.ofOpened !== null ? (
                    <div className="funnel__bar" style={{ width: `${Math.min(1, s.ofOpened) * 100}%` }} />
                  ) : null}
                </div>
                {s.dropped !== null && i > 0 ? (
                  <span className={s === worst ? "funnel__drop funnel__drop--biggest" : "funnel__drop"}>
                    {s === worst ? "Biggest drop: " : ""}
                    {formatNumber(s.dropped)} left before this step
                  </span>
                ) : null}
                {s.key === "booked" ? (
                  <p className="funnel__note">
                    From seeing the calendar to booking covers choosing a time, entering details and paying. Those happen
                    inside GoHighLevel, so the form can't see which part people stop at.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHead
            eyebrow="Programmes"
            title="Programme journeys"
            note="Clicks on “Book a trial” from each class page, then calendars reached and bookings for that programme. People can also reach a calendar without the class page, so the later numbers can be higher."
          />
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Programme</th>
                  <th scope="col">Clicked book</th>
                  <th scope="col">Calendar</th>
                  {bookedHeader("Booked", ghl.state === "ok")}
                </tr>
              </thead>
              <tbody>
                {journeys.map((j) => (
                  <tr key={j.key}>
                    <td>
                      {j.label}
                      {j.key === "kids-teens" ? <span className="cell-sub">All three age groups</span> : null}
                    </td>
                    <td className="num">{formatNumber(j.ctaClicks)}</td>
                    <td className="num">{formatNumber(j.reachedCalendar)}</td>
                    <td className="num">{bookedCell(j.booked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
