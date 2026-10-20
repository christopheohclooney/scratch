import Link from "next/link";
import { Bookings } from "@/components/Bookings";
import { Overview } from "@/components/Overview";
import { loadDashboard } from "@/lib/data";
import { formatTime } from "@/lib/format";
import { parseRange, type Range } from "@/lib/types";

type Tab = "overview" | "bookings";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string; ghl?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = params.tab === "bookings" ? "bookings" : "overview";
  const range = parseRange(params.range);
  /* ?ghl=off only matters with mock data, to preview the "Not connected yet" state. */
  const data = await loadDashboard(range, { mockGhlOff: params.ghl === "off" });

  const href = (next: { tab?: Tab; range?: Range }) => {
    const q = new URLSearchParams({ tab: next.tab ?? tab, range: String(next.range ?? range) });
    if (data.mock && params.ghl === "off") q.set("ghl", "off");
    return `/?${q}`;
  };
  const rangeLinks = { 7: href({ range: 7 }), 30: href({ range: 30 }) };

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/cwbjj-logo.svg" alt="Canary Wharf BJJ" width={157} height={28} />
          <p className="purpose">Is the website turning visits into trial bookings?</p>
        </div>
        <p className="meta">
          Last updated {formatTime(data.updatedAt)} ·{" "}
          <form action="/api/logout" method="post" style={{ display: "inline" }}>
            <button className="text-button" type="submit">
              Sign out
            </button>
          </form>
        </p>
      </header>

      <nav className="page-nav" aria-label="Sections">
        <Link href={href({ tab: "overview" })} aria-current={tab === "overview" ? "page" : undefined}>
          Overview
        </Link>
        <Link href={href({ tab: "bookings" })} aria-current={tab === "bookings" ? "page" : undefined}>
          Bookings
        </Link>
      </nav>

      {tab === "overview" ? (
        <Overview site={data.site} range={range} periods={data.periods} rangeLinks={rangeLinks} />
      ) : (
        <Bookings bookings={data.bookings} ghl={data.ghl} range={range} periods={data.periods} rangeLinks={rangeLinks} />
      )}

      {data.mock ? (
        <p className="mock-banner">
          These are sample numbers for reviewing the layout. Real data appears once PostHog and GoHighLevel are connected.
        </p>
      ) : null}
    </main>
  );
}
