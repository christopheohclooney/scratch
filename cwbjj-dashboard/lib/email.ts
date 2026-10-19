import { formatDate, formatNumber } from "./format";
import { bookingInsights } from "./insights";
import { channelRows } from "./metrics";
import type { DashboardData } from "./types";

/*
  The Monday summary. Plain HTML with inline styles, because email apps ignore
  stylesheets. Dark to match the dashboard, one column so it reads well on a phone.
*/

const c = {
  bg: "#0e0e0e",
  surface: "#161616",
  line: "#262626",
  text: "#f2f2f2",
  muted: "#8a8a8a",
  good: "#7bc49a",
  bad: "#e58a80",
};

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function changeWords(current: number, previous: number, unit = "") {
  const diff = current - previous;
  if (diff === 0) return { text: "same as last week", colour: c.muted };
  return {
    text: `${diff > 0 ? "up" : "down"} ${formatNumber(Math.abs(diff))}${unit} on last week`,
    colour: diff > 0 ? c.good : c.bad,
  };
}

export interface WeeklyEmail {
  subject: string;
  html: string;
  text: string;
}

export function weeklyEmail(data: DashboardData, dashboardUrl: string): WeeklyEmail {
  const site = data.site.ok ? data.site.data : null;
  const bookings = data.bookings.ok ? data.bookings.data : null;
  const ghl = data.ghl.state === "ok" ? data.ghl.data : null;

  const figures: { label: string; value: string; change?: { text: string; colour: string } }[] = [];
  if (site) {
    const { current, previous } = site.totals;
    figures.push({ label: "Visits", value: formatNumber(current.visits), change: changeWords(current.visits, previous.visits) });
  }
  if (ghl) {
    figures.push({ label: "Trial bookings", value: formatNumber(ghl.current), change: changeWords(ghl.current, ghl.previous) });
  } else if (bookings) {
    const f = bookings.funnel;
    figures.push({
      label: "Reached a calendar",
      value: formatNumber(f.current.calendar),
      change: changeWords(f.current.calendar, f.previous.calendar),
    });
  }

  const insights = bookings ? bookingInsights(bookings, data.ghl, 7).slice(0, 2) : [];
  const channels = bookings ? channelRows(bookings, data.ghl).slice(0, 3) : [];
  const channelMeasure = channels[0]?.bookings !== null && channels[0]?.bookings !== undefined ? "bookings" : "reached a calendar";

  const headline = ghl
    ? `${formatNumber(ghl.current)} trial ${ghl.current === 1 ? "booking" : "bookings"}, ${
        ghl.current === ghl.previous ? "same as last week" : `${ghl.current > ghl.previous ? "up" : "down"} ${Math.abs(ghl.current - ghl.previous)}`
      }`
    : site
      ? `${formatNumber(site.totals.current.visits)} visits, ${changeWords(site.totals.current.visits, site.totals.previous.visits).text.replace(" on last week", "")}`
      : "your weekly summary";
  const subject = `Your website this week: ${headline}`;

  const figureRows = figures
    .map(
      (f) => `
      <tr><td style="padding:16px 20px;border-top:1px solid ${c.line}">
        <div style="font-size:13px;color:${c.muted}">${esc(f.label)}</div>
        <div style="font-size:32px;line-height:1.2;color:${c.text};letter-spacing:-0.5px">${esc(f.value)}</div>
        ${f.change ? `<div style="font-size:13px;color:${f.change.colour}">${esc(f.change.text)}</div>` : ""}
      </td></tr>`,
    )
    .join("");

  const insightRows = insights
    .map((line) => `<tr><td style="padding:6px 0;font-size:16px;line-height:1.45;color:${c.text}">■&nbsp;&nbsp;${esc(line)}</td></tr>`)
    .join("");

  const channelTableRows = channels
    .map(
      (ch) => `
      <tr>
        <td style="padding:10px 0;border-top:1px solid ${c.line};font-size:15px;color:${c.text}">${esc(ch.label)}</td>
        <td align="right" style="padding:10px 0;border-top:1px solid ${c.line};font-size:15px;color:${c.text}">${formatNumber(
          ch.bookings ?? ch.reachedCalendar,
        )}</td>
      </tr>`,
    )
    .join("");

  const missing = [!site && "website visits", !bookings && "booking form numbers", data.ghl.state === "error" && "GoHighLevel bookings"]
    .filter(Boolean)
    .join(", ");

  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bg};color:${c.text};font-family:Geist,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-family:'Geist Mono',Menlo,monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${c.muted}">■&nbsp; Canary Wharf BJJ</td></tr>
  <tr><td style="padding:16px 0 24px;font-size:28px;line-height:1.15;letter-spacing:-0.5px">
    <span style="color:${c.text}">Your website this week</span><br>
    <span style="color:${c.muted}">${esc(headline.charAt(0).toUpperCase() + headline.slice(1))}.</span>
  </td></tr>
  ${
    figureRows
      ? `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.surface};border:1px solid ${c.line};border-radius:4px;border-top:0">${figureRows}</table></td></tr>`
      : ""
  }
  ${insightRows ? `<tr><td style="padding:28px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${insightRows}</table></td></tr>` : ""}
  ${
    channelTableRows
      ? `<tr><td style="padding:28px 0 0">
          <div style="font-family:'Geist Mono',Menlo,monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${c.muted};padding-bottom:8px">■&nbsp; Top channels · ${channelMeasure}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${channelTableRows}</table>
        </td></tr>`
      : ""
  }
  ${missing ? `<tr><td style="padding:24px 0 0;font-size:13px;color:${c.muted}">Couldn't load ${esc(missing)} this time.</td></tr>` : ""}
  <tr><td style="padding:32px 0 8px">
    <a href="${esc(dashboardUrl)}" style="display:inline-block;padding:12px 20px;background:${c.text};color:${c.bg};border-radius:4px;text-decoration:none;font-size:15px">Open the dashboard</a>
  </td></tr>
  <tr><td style="padding-top:24px;font-size:12px;color:${c.muted}">Covers ${formatDate(data.periods.current.from)} to ${formatDate(data.periods.current.to)}, compared with the week before.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    subject,
    "",
    ...figures.map((f) => `${f.label}: ${f.value}${f.change ? ` (${f.change.text})` : ""}`),
    "",
    ...insights,
    "",
    channels.length ? `Top channels (${channelMeasure}):` : "",
    ...channels.map((ch) => `${ch.label}: ${formatNumber(ch.bookings ?? ch.reachedCalendar)}`),
    "",
    `Open the dashboard: ${dashboardUrl}`,
  ].join("\n");

  return { subject, html, text };
}

