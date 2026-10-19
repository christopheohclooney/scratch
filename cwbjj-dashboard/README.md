# Canary Wharf BJJ: website dashboard

A password-protected dashboard for João, with two tabs:

- **Overview**: visits, page views, bounce rate, time on site, visits per day, top pages and devices.
- **Bookings**: where trial bookings come from (by channel), where people drop out of the booking form, and how each programme's class page turns into bookings.

João also gets a short summary email every Monday morning.

Built with Next.js (App Router) and TypeScript. It's deployed to Vercel as its own project from this folder, separate from the booking form in `cw-bjj-booking/`.

## Where the numbers come from

| What | Source |
|---|---|
| Visits, pages, devices, channels | PostHog: the site-wide snippet in Framer (`framer/posthog-snippet.html`) |
| Booking form steps | PostHog: events sent by the booking form (`cw-bjj-booking/src/track.ts`) |
| Trial bookings | GoHighLevel API: appointments on the seven trial calendars |

Framer's built-in analytics has no API (only a CSV export from its dashboard), so the dashboard uses PostHog for both tabs. That way "Visits" means the same thing everywhere.

**Tracking is cookieless.** PostHog keeps its IDs in page memory, so nothing is stored on the visitor's device and no cookie banner is needed for it. The trade-off: a visit lasts until the visitor reloads or opens a new tab, so someone who comes back on another day counts again. The dashboard calls these "visits" for that reason.

### Events

| Event | Sent by | When |
|---|---|---|
| `$pageview` | Framer snippet | Every page, including Framer's in-page navigation |
| `cta_clicked` `{programme}` | Framer snippet | A link to the booking page is clicked on a class page |
| `booking_form_viewed` | Booking form | The form loads |
| `booking_audience_selected` `{audience}` | Booking form | Adult or Child chosen (also sent for `?programme=` deep links) |
| `booking_programme_selected` `{programme}` | Booking form | A programme or age group chosen (also for deep links) |
| `booking_calendar_loaded` `{programme}` | Booking form | The GHL calendar finishes loading |
| `booking_completed` `{programme}` | Booking form | GHL tells the form a booking finished (see below) |

The Framer embed passes the visitor's PostHog IDs and UTMs into the booking form's iframe, so the site visit and the form are one visit in PostHog.

### Booking completion

GoHighLevel doesn't document whether its booking widget tells the page when a booking finishes. Third-party guides say it sends a `msgsndr-booking-complete` message. The booking form listens for it and sends `booking_completed` if it arrives.

**To check:** open the booking form directly with `?debug=1` (for example `https://scratch-delta-three.vercel.app/?programme=gi&debug=1`), open the browser console, and make a real test booking. Every message from GHL is logged with `[cwbjj] GHL message`.

- If `msgsndr-booking-complete` appears, bookings per channel appear on the dashboard once GHL is connected.
- If it doesn't, the channel table ranks by "Reached calendar" and says bookings per channel aren't available. Total bookings still come from the GHL API.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run build                # production build (also typechecks)
```

With `USE_MOCK_DATA=1`, the dashboard shows realistic sample numbers and makes no API calls. That's for reviewing the layout. While using sample data, add `&ghl=off` to the address to preview the "Not connected yet" state.

## Environment variables

Set these in Vercel under **Settings → Environment Variables** (and in `.env.local` for local work).

| Variable | What it is | Where to find it |
|---|---|---|
| `DASHBOARD_PASSWORD` | The password João types to sign in | Make one up |
| `AUTH_SECRET` | Signs the sign-in cookie. Changing it signs everyone out | Any long random string, for example from `openssl rand -base64 32` |
| `USE_MOCK_DATA` | `1` for sample numbers, leave empty for real data | |
| `POSTHOG_HOST` | `https://eu.posthog.com` | |
| `POSTHOG_PROJECT_ID` | The PostHog project number | PostHog → Project settings → General → Project ID |
| `POSTHOG_PERSONAL_API_KEY` | Lets the dashboard read data | PostHog → your avatar → Personal API keys → Create. Scope: **Query: Read**, limited to this project |
| `GHL_TOKEN` | Private Integration token | GHL sub-account → Settings → Private Integrations → Create. Scopes: **View Calendars**, **View Calendar Events** |
| `GHL_LOCATION_ID` | João's sub-account ID | GHL sub-account → Settings → Business Profile (Location ID), or in the sub-account's URL |
| `RESEND_API_KEY` | Sends the weekly email | resend.com → API Keys |
| `REPORT_FROM` | Sender, for example `Canary Wharf BJJ <dashboard@canarywharfbjj.com>` | Must be on a domain verified in Resend |
| `REPORT_RECIPIENT` | Who gets the email. Separate several with commas | João's address |
| `CRON_SECRET` | Stops anyone else triggering the email | Any long random string. Vercel sends it automatically with cron calls |
| `DASHBOARD_URL` | The dashboard's address, for the email button | The Vercel production URL |

The PostHog **project API key** (starts `phc_`) is different from the personal API key. It's public and goes in the Framer snippet and in `cw-bjj-booking/src/config/analytics.ts`.

**Until `GHL_TOKEN` and `GHL_LOCATION_ID` are set,** the bookings tiles, the "Booked and paid" step and the bookings columns show "Not connected yet". The channel table ranks by "Reached calendar", and booking-based insights and email lines are left out. Adding both variables (then redeploying) switches it all on with no code changes.

### GoHighLevel details to confirm

These are coded from GHL's API v2 docs and need checking against the live account once the token exists:

- The dashboard finds each calendar's ID by its booking-link slug (`widgetSlug`, for example `adults-beginners-1`) from `GET /calendars/`. The slugs are in `lib/config/site.ts`.
- Appointments come from `GET /calendars/events`. That endpoint filters by class time, not by when someone booked, so the dashboard fetches 90 days ahead and counts by `dateAdded` (when it was booked).
- Every appointment counts except `cancelled` and `invalid`. No-shows count, because they booked and paid.

## Deploy to Vercel

1. In Vercel, choose **Add New → Project** and import the `scratch` repo again (a second project, alongside the booking form).
2. Set **Root Directory** to `cwbjj-dashboard`. Vercel detects Next.js.
3. Add the environment variables above. Start with `USE_MOCK_DATA=1`, `DASHBOARD_PASSWORD` and `AUTH_SECRET` to review the layout.
4. Under **Settings → Environments → Production → Branch Tracking**, choose the branch this work lives on.
5. Deploy. Every push to that branch redeploys.

## Setting up tracking

1. **Create a PostHog project** at eu.posthog.com (EU hosting). Under Project settings, turn off session replay and autocapture. They aren't used.
2. **Framer:** paste `framer/posthog-snippet.html` into Site Settings → General → Custom Code → End of `<head>` tag. Replace `phc_REPLACE_ME` with the project API key. If the booking page isn't at `/book`, change `BOOKING_PATH`. Publish.
3. **Booking form:** put the same project API key in `cw-bjj-booking/src/config/analytics.ts` and push. Re-paste `cw-bjj-booking/framer-embed.html` into the booking page's Embed, because it changed.
4. **Check it:** visit the site with `?utm_source=test`, go to the booking page and pick a programme. In PostHog → Activity, the page views and booking events should share one person and one session ID, and carry `utm_source=test`.
5. **Page names:** the friendly names in "Top pages" come from `pageNames` in `lib/config/site.ts`. Update them if the real Framer paths differ.

## Weekly email

`vercel.json` runs `/api/cron/weekly` at 07:00 and 08:00 UTC every Monday. The route only sends on the run that is 8am in London, so the time stays right when the clocks change.

- **Change the day or time:** edit `schedule` in `vercel.json` (cron format, in UTC) and `SEND_HOUR` in `app/api/cron/weekly/route.ts` (London hour). For example, Tuesday 9am is `"0 8,9 * * 2"` and `SEND_HOUR = 9`.
- **Send a test now:** `curl -H "Authorization: Bearer $CRON_SECRET" "https://<dashboard>/api/cron/weekly?force=1"`.
- **Change the recipient:** update `REPORT_RECIPIENT` in Vercel.

Vercel cron jobs only run on production deployments.

## Where things live

| What | File |
|---|---|
| Colours and fonts (CSS variables at the top) | `app/globals.css` |
| Page names, calendars, class pages | `lib/config/site.ts` |
| How referrers are grouped into channels | `lib/config/channels.ts` |
| PostHog queries | `lib/sources/posthog.ts` |
| GoHighLevel bookings | `lib/sources/ghl.ts` |
| Sample data | `lib/sources/mock.ts` |
| Caching (one hour) and per-section errors | `lib/data.ts` |
| Funnel, channel table, programme journeys | `lib/metrics.ts` |
| Plain-English insight rules | `lib/insights.ts` |
| Weekly email | `lib/email.ts`, `app/api/cron/weekly/route.ts` |
| Sign-in | `lib/auth.ts`, `proxy.ts`, `app/login/` |
| Links for João's posts and ads | `UTM-LINKS.md` |
