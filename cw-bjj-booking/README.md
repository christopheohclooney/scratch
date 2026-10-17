# Canary Wharf BJJ: trial booking flow

A single-page selector that routes people to the right GoHighLevel (GHL) booking calendar. It is embedded in the Framer site with an iframe. It collects no personal details and takes no payment. GHL handles class choice, contact details, intake questions, Stripe payment and confirmation emails.

How it works:

1. **Who's training?** Adult or Child.
2. **Choose your programme** (Adult) or **Choose their age group** (Child).
3. **Book your class.** The matching GHL calendar loads.

Later steps stay greyed out until the earlier one is answered. Changing an answer resets everything after it. Only one calendar is ever loaded at a time.

Built with Vite and vanilla TypeScript. It's a static site with no backend, API keys or secrets.

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

### Updating a calendar URL

Edit the `embedUrl` for that programme in `src/config/calendars.ts`, then commit. Vercel redeploys automatically. Labels shown to people come from `label`, never from the GHL URL, because the GHL slugs don't match the programme names (for example `kids-4-6yrs` is the Kids 4 to 5 calendar).

### Updating the explainer copy

Replace the placeholder text in `copy.explainer.items` in `src/config/copy.ts`. Keys match the calendar slugs.

## Deep links

Add `?programme=<slug>` to preselect a programme and load its calendar straight away:

`adult-beginners`, `gi`, `no-gi`, `adult-striking`, `kids-4-5`, `kids-6-11`, `teens-12-15`

Put the parameter on the Framer booking page URL (for example `/book?programme=gi`). The Framer snippet passes it through to the iframe. Unknown slugs are ignored.

## Deploy to Vercel

1. In Vercel, choose **Add New → Project** and import the `scratch` repo.
2. Set **Root Directory** to `cw-bjj-booking`.
3. Vercel detects Vite. The build command is `npm run build` and the output directory is `dist`. No environment variables are needed.
4. Deploy, and note the production URL (for example `cw-bjj-booking.vercel.app`).

Every push to the production branch redeploys.

## Embed in Framer

1. Open `framer-embed.html` and replace `YOUR-PROJECT.vercel.app` with your Vercel domain. It appears twice: in the iframe `src` and in `APP_ORIGIN`.
2. In Framer, add an **Embed** to the booking page, set its type to **HTML**, and paste the whole file in.
3. Set the Embed width to **Fill** and its height to **Fit Content**.

The snippet:

- sizes the iframe to the flow's exact height, so there's never a second scrollbar (`cwbjj-booking-height` messages)
- smoothly scrolls the Framer page to each new step as it activates (`cwbjj-booking-scroll` messages)
- only accepts messages from your Vercel origin
- forwards `?programme=` from the page URL

If Framer wraps the Embed in its own frame and the height doesn't follow the content, also paste the snippet's `<script>` block into **Site Settings → General → Custom Code → End of `<body>` tag**. The script guards against running twice, and it finds the right frame either way.

## Motion

- The motion follows the Art of Jiu Jitsu booking page. Buttons change state over 0.25s. After each answer, the next step fades in with a slight rise, and the page eases down so the new step sits near the top with some room above it (about 0.6 to 1s).
- Timings are CSS variables in `src/styles.css`. The scroll curve is in `src/embed.ts`, with a matching copy in `framer-embed.html`.
- With `prefers-reduced-motion`, there's no animation and scrolling is instant.
