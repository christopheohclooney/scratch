import { pageNames } from "@/lib/config/site";
import { formatDuration, formatNumber, formatPercent, periodWords, share } from "@/lib/format";
import { deviceReading, siteSummary } from "@/lib/insights";
import type { Loaded, Periods, Range, SiteData } from "@/lib/types";
import { LineChart } from "./LineChart";
import { Item } from "./motion";
import {
  definitions,
  Delta,
  Guide,
  HeroStat,
  IntroHeader,
  MiniStat,
  MiniStats,
  type RangeLinks,
  SectionError,
  SectionHead,
  Summary,
} from "./ui";

const TOP_PAGES = 8;

export function Overview({
  site,
  range,
  periods,
  rangeLinks,
}: {
  site: Loaded<SiteData>;
  range: Range;
  periods: Periods;
  rangeLinks: RangeLinks;
}) {
  return (
    <>
      <Item>
        <IntroHeader line1="Overview" line2="How the website is doing." periods={periods} range={range} rangeLinks={rangeLinks}>
          {site.ok ? <Summary lines={[siteSummary(site.data, range), deviceReading(site.data.devices)]} /> : null}
        </IntroHeader>
      </Item>

      {!site.ok ? (
        <Item>
          <SectionError what="website visits" error={site.error} />
        </Item>
      ) : (
        <SiteSections site={site.data} range={range} />
      )}

      <Item>
        <Guide
          items={[
            ["Visit", definitions.visit],
            ["Page views", "Every page opened, so one visit can have several."],
            ["Bounce rate", definitions.bounce],
            ["Time on site", definitions.timeOnSite],
          ]}
        />
      </Item>
    </>
  );
}

function SiteSections({ site, range }: { site: SiteData; range: Range }) {
  const words = periodWords(range);
  const { current, previous } = site.totals;
  const deviceTotal = site.devices.mobile + site.devices.desktop;
  const mobileShare = share(site.devices.mobile, deviceTotal);

  /* Named pages only; anything else is summed into one line so raw addresses never show. */
  const named = site.topPages.filter((p) => pageNames[p.path]);
  const shown = named.slice(0, TOP_PAGES);
  const otherCount = site.topPages.length - shown.length;

  return (
    <>
      <Item>
        <section className="card hero-card" aria-label="Visits">
          <HeroStat
            label="Visits"
            value={formatNumber(current.visits)}
            delta={<Delta current={current.visits} previous={previous.visits} range={range} />}
          />
          <LineChart data={site.daily} currentLabel={words.currentLabel} previousLabel={words.previousLabel} />
        </section>
      </Item>

      <Item>
        <MiniStats>
          <MiniStat
            label="Page views"
            value={formatNumber(current.pageviews)}
            delta={<Delta current={current.pageviews} previous={previous.pageviews} range={range} short />}
          />
          <MiniStat
            label="Bounce rate"
            value={formatPercent(current.bounceRate)}
            delta={<Delta current={current.bounceRate} previous={previous.bounceRate} range={range} higherIsBetter={false} short />}
          />
          <MiniStat
            label="Time on site"
            value={formatDuration(current.avgVisitSeconds)}
            delta={<Delta current={current.avgVisitSeconds} previous={previous.avgVisitSeconds} range={range} short />}
          />
          <MiniStat label="On a phone or tablet" value={deviceTotal === 0 ? "–" : formatPercent(mobileShare)}>
            {deviceTotal === 0 ? null : (
              <span
                className="split-bar split-bar--mini"
                role="img"
                aria-label={`${formatPercent(mobileShare)} on phones and tablets, ${formatPercent(1 - mobileShare!)} on computers`}
              >
                {site.devices.mobile > 0 ? <span className="split-bar__a" style={{ width: `${mobileShare! * 100}%` }} /> : null}
                {site.devices.desktop > 0 ? <span className="split-bar__b" style={{ flex: 1 }} /> : null}
              </span>
            )}
          </MiniStat>
        </MiniStats>
      </Item>

      <Item>
        <section className="section">
          <SectionHead eyebrow="Pages" title="What are people looking at?" note="The share is how many visits included that page." />
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col">Visits</th>
                  <th scope="col">Share</th>
                  <th scope="col">Avg. time</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="cell-muted">
                      No page views yet.
                    </td>
                  </tr>
                ) : (
                  shown.map((p) => (
                    <tr key={p.path}>
                      <td>{pageNames[p.path]}</td>
                      <td className="num">{formatNumber(p.visits)}</td>
                      <td className="num cell-muted">{formatPercent(share(p.visits, current.visits))}</td>
                      <td className="num">{formatDuration(p.avgSeconds)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {otherCount > 0 ? (
              <p className="table-foot">
                Plus {otherCount} other {otherCount === 1 ? "page" : "pages"} with fewer visits.
              </p>
            ) : null}
          </div>
        </section>
      </Item>
    </>
  );
}
