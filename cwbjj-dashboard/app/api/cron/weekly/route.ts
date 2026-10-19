import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { loadDashboard } from "@/lib/data";
import { weeklyEmail } from "@/lib/email";

/*
  Sends João's Monday summary. Vercel calls this once on Monday mornings (see
  vercel.json); every call with the CRON_SECRET sends, so calling it by hand
  sends a test straight away.
*/

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
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
