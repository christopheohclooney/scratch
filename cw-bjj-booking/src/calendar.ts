import { type Calendar, ghlEmbedScript } from "./config/calendars";
import { copy } from "./config/copy";
import { debug, utms } from "./track";

/*
  GHL's form_embed.js sizes widget iframes with a handshake that only runs for
  iframes present when the script executes, so a swapped-in calendar would never
  be sized. Running a fresh copy after each mount registers the new iframe. The
  browser serves it from cache, so this costs no extra download.
*/
function runGhlScript() {
  document.querySelectorAll("script[data-ghl-embed]").forEach((s) => s.remove());
  const script = document.createElement("script");
  script.src = ghlEmbedScript;
  script.async = true;
  script.dataset.ghlEmbed = "";
  document.body.appendChild(script);
}

function loadingIndicator() {
  const loading = document.createElement("div");
  loading.className = "calendar-loading";
  loading.setAttribute("role", "status");
  loading.innerHTML = `<span class="calendar-loading__bar" aria-hidden="true"></span><span>${copy.step3.loading}</span>`;
  return loading;
}

/* Passes the visitor's UTMs on to GHL, in case it stores them against the contact. */
function withUtms(embedUrl: string) {
  const url = new URL(embedUrl);
  for (const [key, value] of Object.entries(utms)) url.searchParams.set(key, value);
  return url.toString();
}

/* Shows the loading state on its own, before the calendar iframe is added. */
export function showCalendarLoading(slot: HTMLElement) {
  slot.replaceChildren(loadingIndicator());
}

/* Replaces whatever is in the slot with a single calendar. */
export function mountCalendar(slot: HTMLElement, calendar: Calendar, onLoad: () => void) {
  slot.replaceChildren();

  const loading = loadingIndicator();

  const iframe = document.createElement("iframe");
  iframe.src = withUtms(calendar.embedUrl);
  iframe.id = `${calendar.slug}_${Date.now()}`;
  iframe.title = copy.step3.iframeTitle(calendar.label);
  iframe.className = "calendar-frame";
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("allow", "payment");
  iframe.addEventListener(
    "load",
    () => {
      loading.remove();
      iframe.classList.add("is-loaded");
      onLoad();
    },
    { once: true },
  );

  slot.append(loading, iframe);
  runGhlScript();
}

export function clearCalendar(slot: HTMLElement) {
  slot.replaceChildren();
}

const ghlOrigin = /^https:\/\/([a-z0-9-]+\.)*(leadconnectorhq\.com|msgsndr\.com)$/;

/*
  Calls onComplete when the GHL widget reports a finished booking. GHL doesn't
  document its messages; third-party guides report "msgsndr-booking-complete" as
  the first item of an array. Add ?debug=1 to the form URL to log every message
  from GHL during a test booking.
*/
export function watchGhlBookings(onComplete: () => void) {
  window.addEventListener("message", (event) => {
    if (!ghlOrigin.test(event.origin)) return;
    if (debug) console.info("[cwbjj] GHL message", event.origin, event.data);
    const name = Array.isArray(event.data) ? event.data[0] : event.data;
    if (name === "msgsndr-booking-complete") onComplete();
  });
}
