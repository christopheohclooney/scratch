/*
  Talking to the Framer page that hosts this flow in an iframe.

  The page never scrolls internally. It reports its height so the parent can size
  the iframe, and it asks the parent to scroll when a new step becomes active.
  Opened directly (not embedded), it scrolls itself instead.
*/

export const isEmbedded = window.self !== window.top;

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Posted to the direct parent and, when Framer wraps the embed in its own frame, to the top page too. */
const post = (message: Record<string, unknown>) => {
  const targets = new Set<Window>([window.parent]);
  if (window.top) targets.add(window.top);
  targets.forEach((t) => {
    if (t !== window) t.postMessage(message, "*");
  });
};

export function reportHeight() {
  let last = 0;
  const send = () => {
    const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === last) return;
    last = height;
    post({ type: "cwbjj-booking-height", height });
  };
  new ResizeObserver(send).observe(document.body);
  window.addEventListener("load", send);
  send();
}

/* Calm, decelerating curve, close to the Art of Jiu Jitsu scroll. */
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

let scrollFrame = 0;

function animateWindowScroll(to: number) {
  cancelAnimationFrame(scrollFrame);
  const from = window.scrollY;
  const distance = to - from;
  if (Math.abs(distance) < 2) return;
  if (prefersReducedMotion()) {
    window.scrollTo(0, to);
    return;
  }
  const duration = Math.min(1000, Math.max(600, Math.abs(distance) * 0.9));
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, from + distance * easeInOutCubic(t));
    if (t < 1) scrollFrame = requestAnimationFrame(step);
  };
  scrollFrame = requestAnimationFrame(step);
}

/* Brings an element into view, leaving breathing room above it. */
export function scrollToElement(el: HTMLElement) {
  const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
  if (isEmbedded) {
    post({ type: "cwbjj-booking-scroll", top });
    return;
  }
  const breathingRoom = Math.round(window.innerHeight * 0.12);
  animateWindowScroll(Math.max(0, top - breathingRoom));
}
