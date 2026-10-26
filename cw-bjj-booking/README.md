# Canary Wharf BJJ: trial booking flow

A single-page selector that routes people to the right GoHighLevel (GHL) booking calendar. It is embedded in the Framer site with an iframe. It collects no personal details and takes no payment. GHL handles class choice, contact details, intake questions, Stripe payment and confirmation emails.

How it works:

1. **Who's training?** Adult or Child.
2. **Choose your programme** (Adult) or **Choose their age group** (Child).
3. **Book your class.** The matching GHL calendar loads.

Later steps stay greyed out until the earlier one is answered. Changing an answer resets everything after it. Only one calendar is ever loaded at a time.

Built with Vite and vanilla TypeScript. It's a static site with no backend or secrets. It sends cookieless analytics events to PostHog (see Tracking).

## Run locally

```bash
npm install
npm run dev       # dev server on localhost:5173
npm run build     # typecheck and build to dist/
npm run preview   # serve the built site on localhost:4173
```

## Where things live

| What | File |
|---|---|
| The seven GHL calendars (slug, label, group, embed URL) | `src/config/calendars.ts` |
| All visible copy, including the "Which programme is right for me?" text | `src/config/copy.ts` |
| Colours, fonts, spacing and motion timings (CSS variables at the top) | `src/styles.css` |
| Step logic, resets, deep links | `src/main.ts` |
| Loading a GHL calendar and its resize script | `src/calendar.ts` |
| Height and scroll messages to the Framer page | `src/embed.ts` |
| Snippet to paste into Framer | `framer-embed.html` |
| PostHog events and settings | `src/track.ts`, `src/config/analytics.ts` |

### Updating a calendar URL

Edit the `embedUrl` for that programme in `src/config/calendars.ts`, then commit. Vercel redeploys automatically. Labels shown to people come from `label`, never from the GHL URL, because the GHL slugs don't match the programme names (for example `kids-4-6yrs` is the Kids 4 to 5 calendar).

### Updating the explainer copy

Replace the placeholder text in `copy.explainer.items` in `src/config/copy.ts`. Keys match the calendar slugs.

## Deep links

Add `?programme=<slug>` to preselect a programme and load its calendar straight away:

`adult-beginners`, `gi`, `no-gi`, `adult-striking`, `kids-4-5`, `kids-6-11`, `teens-12-15`

Put the parameter on the Framer booking page URL (for example `/book-a-trial?programme=gi`). The Framer snippet passes it through to the iframe. Unknown slugs are ignored.

## Deploy to Vercel

1. In Vercel, choose **Add New → Project** and import the `scratch` repo.
2. Set **Root Directory** to `cw-bjj-booking`.
3. Vercel detects Vite. The build command is `npm run build` and the output directory is `dist`. No environment variables are needed.
4. Under **Settings → Environments → Production → Branch Tracking**, set the branch to `cw-bjj-form` (the branch name, not the folder name). Vercel builds `main` by default, and `main` doesn't contain the app, so it shows a 404.
5. Push a commit to `cw-bjj-form` (or use **Create New → Deployment** and enter the branch), and note the production URL (for example `scratch-delta-three.vercel.app`).

Every push to the production branch redeploys. Use the production URL in Framer, not a preview link: preview links sit behind Vercel's login by default.

## Embed in Framer

1. `framer-embed.html` already points at `scratch-delta-three.vercel.app`. If the Vercel address changes (for example a custom domain), update it in both places: the iframe `src` and `APP_ORIGIN`.
2. In Framer, add an **Embed** to the booking page, set its type to **HTML**, and paste the whole file in.
3. Set the Embed width to **Fill** and its height to **Fit Content**.

The snippet:

- sizes the iframe to the flow's exact height, so there's never a second scrollbar (`cwbjj-booking-height` messages)
- smoothly scrolls the Framer page to each new step as it activates (`cwbjj-booking-scroll` messages)
- only accepts messages from your Vercel origin
- forwards `?programme=` and any `utm_` parameters from the page URL
- passes the visitor's PostHog IDs, so the site visit and the form count as one visit (it waits up to 1.5s for PostHog)

Framer runs Embed HTML inside its own invisible frame. The snippet reaches past it to scroll the real page and read its `?programme=`, so paste it only into the Embed. Don't also add it to Site Settings → Custom Code, or the page will scroll twice.

## Motion

- The motion follows the Art of Jiu Jitsu booking page. Buttons change state over 0.25s. After each answer, the next step fades in with a slight rise, and the page eases down so the new step sits near the top with some room above it (about 0.6 to 1s).
- Timings are CSS variables in `src/styles.css`. The scroll curve is in `src/embed.ts`, with a matching copy in `framer-embed.html`.
- With `prefers-reduced-motion`, there's no animation and scrolling is instant.

## Tracking

The form sends these events to PostHog, for the dashboard in `cwbjj-dashboard/`:

- `booking_form_viewed` when the form loads
- `booking_audience_selected` with `audience` (`adult` or `child`)
- `booking_programme_selected` with `programme` (a calendar slug)
- `booking_calendar_loaded` with `programme`, when the GHL calendar has loaded
- `booking_completed` with `programme`, if GHL reports a finished booking

Deep links send the audience and programme events too, marked `deep_link`. Every event carries the visitor's UTMs, which are also added to the GHL calendar URL.

Tracking is cookieless: PostHog keeps everything in page memory. It's off until the PostHog project API key is set in `src/config/analytics.ts`.

Add `?debug=1` to the form's URL to log every event, and every message from the GHL calendar, in the browser console. Use it during a test booking to see whether GHL sends `msgsndr-booking-complete`.
