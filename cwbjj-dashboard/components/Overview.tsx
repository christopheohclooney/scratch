import { pageName } from "@/lib/config/site";
import { formatDuration, formatNumber, formatPercent, periodWords, share } from "@/lib/format";
import { siteSummary } from "@/lib/insights";
import type { Loaded, Range, SiteData } from "@/lib/types";
import { LineChart } from "./LineChart";
import { Delta, Heading, SectionError, SectionHead, Tile } from "./ui";

export function Overview({ site, range }: { site: Loaded<SiteData>; range: Range }) {
  const words = periodWords(range);
  return (
    <>
      <div className="intro">
        <Heading line1="Overview" line2="How the website is doing." />
        {site.ok ? <p className="summary">{siteSummary(site.data, range)}</p> : null}
      </div>

      {!site.ok ? (
        <SectionError what="website visits" error={site.error} />
      ) : (
        <SiteSections site={site.data} range={range} currentLabel={words.currentLabel} previousLabel={words.previousLabel} />
      )}
    </>
  );
}

function SiteSections({
  site,
  range,
  currentLabel,
  previousLabel,
}: {
  site: SiteData;
  range: Range;
  currentLabel: string;
  previousLabel: string;
}) {
  const { current, previous } = site.totals;
  const deviceTotal = site.devices.mobile + site.devices.desktop;
  const mobileShare = share(site.devices.mobile, deviceTotal);

  return (
    <>
      <div className="tiles">
        <Tile
          label="Visits"
          value={formatNumber(current.visits)}
          delta={<Delta current={current.visits} previous={previous.visits} range={range} />}
          hint="A returning visitor counts again on each visit."
        />
        <Tile
          label="Page views"
          value={formatNumber(current.pageviews)}
          delta={<Delta current={current.pageviews} previous={previous.pageviews} range={range} />}
        />
        <Tile
          label="Bounce rate"
          value={formatPercent(current.bounceRate)}
          delta={<Delta current={current.bounceRate} previous={previous.bounceRate} range={range} higherIsBetter={false} />}
          hint="Visits that saw one page and left."
        />
        <Tile
          label="Average time on site"
          value={formatDuration(current.avgVisitSeconds)}
          delta={<Delta current={current.avgVisitSeconds} previous={previous.avgVisitSeconds} range={range} />}
        />
      </div>

      <section className="section">
        <SectionHead eyebrow="Visits" title="Visits per day" />
        <div className="card">
          <LineChart data={site.daily} currentLabel={currentLabel} previousLabel={previousLabel} />
        </div>
      </section>

      <div className="split section">
        <section>
          <SectionHead eyebrow="Pages" title="Top pages" />
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col">Visits</th>
                  <th scope="col">Avg. time</th>
                </tr>
              </thead>
              <tbody>
                {site.topPages.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="cell-muted">
                      No page views yet.
                    </td>
                  </tr>
                ) : (
                  site.topPages.map((p) => (
                    <tr key={p.path}>
                      <td>{pageName(p.path)}</td>
                      <td className="num">{formatNumber(p.visits)}</td>
                      <td className="num">{formatDuration(p.avgSeconds)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <SectionHead eyebrow="Devices" title="Phone or computer" />
          <div className="card">
            {deviceTotal === 0 ? (
              <p className="cell-muted">No visits yet.</p>
            ) : (
              <>
                <div
                  className="split-bar"
                  role="img"
                  aria-label={`${formatPercent(mobileShare)} on phones and tablets, ${formatPercent(1 - mobileShare!)} on computers`}
                >
                  {site.devices.mobile > 0 ? <span className="split-bar__a" style={{ width: `${mobileShare! * 100}%` }} /> : null}
                  {site.devices.desktop > 0 ? <span className="split-bar__b" style={{ flex: 1 }} /> : null}
                </div>
                <div className="legend-row">
                  <span>
                    <span className="swatch" style={{ background: "var(--chart-current)" }} />
                    Phone & tablet <span className="mono">{formatPercent(mobileShare)}</span>
                  </span>
                  <span>
                    <span className="swatch" style={{ background: "var(--chart-previous)" }} />
                    Computer <span className="mono">{formatPercent(1 - mobileShare!)}</span>
                  </span>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
