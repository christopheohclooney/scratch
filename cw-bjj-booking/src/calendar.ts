import { type Calendar, ghlEmbedScript } from "./config/calendars";
import { copy } from "./config/copy";

let scriptRequested = false;

/* GHL's form_embed.js listens for size messages from its widgets, so one copy covers every swap. */
function ensureGhlScript() {
  if (scriptRequested) return;
  scriptRequested = true;
  const script = document.createElement("script");
  script.src = ghlEmbedScript;
  script.async = true;
  document.body.appendChild(script);
}

/* Replaces whatever is in the slot with a single calendar. Returns once the iframe is in the DOM. */
export function mountCalendar(slot: HTMLElement, calendar: Calendar, onLoad: () => void) {
  ensureGhlScript();
  slot.replaceChildren();

  const loading = document.createElement("div");
  loading.className = "calendar-loading";
  loading.setAttribute("role", "status");
  loading.innerHTML = `<span class="calendar-loading__bar" aria-hidden="true"></span><span>${copy.step3.loading}</span>`;

  const iframe = document.createElement("iframe");
  iframe.src = calendar.embedUrl;
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
}

export function clearCalendar(slot: HTMLElement) {
  slot.replaceChildren();
}
