import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { loadDashboard } from "@/lib/data";
import { weeklyEmail } from "@/lib/email";
import { timeZone } from "@/lib/period";

/*
  Sends João's Monday summary. Vercel calls this at 07:00 and 08:00 UTC on Mondays
  (see vercel.json); it only sends on the run that is 8am in London, so the time
  stays right through the clock changes. Add ?force=1 to send straight away
  when testing (still needs the CRON_SECRET).
*/

export const dynamic = "force-dynamic";

const SEND_HOUR = 8;

function londonHour(now: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  if (!force && londonHour(new Date()) !== SEND_HOUR) {
    return NextResponse.json({ skipped: `Not ${SEND_HOUR}am in London` });
  }

  const to = process.env.REPORT_RECIPIENT;
  const from = process.env.REPORT_FROM;
  if (!process.env.RESEND_API_KEY || !to || !from) {
    return NextResponse.json({ error: "RESEND_API_KEY, REPORT_RECIPIENT and REPORT_FROM must be set" }, { status: 500 });
  }

  const data = await loadDashboard(7);
  const dashboardUrl = process.env.DASHBOARD_URL ?? request.nextUrl.origin;
  const email = weeklyEmail(data, dashboardUrl);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sent, error } = await resend.emails.send({
    from,
    to: to.split(",").map((s) => s.trim()),
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ sent: sent?.id, subject: email.subject });
}
