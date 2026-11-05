"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/* Keep the bubble this far from the screen edges. */
const GUTTER = 16;

/*
  A small ⓘ that explains a figure. Opens on hover or focus on a computer, and
  on tap on a phone; tapping elsewhere or pressing Escape closes it.
*/
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<{ above: boolean; shift: number }>({ above: false, shift: 0 });
  /* A tap fires focus (or hover) and then click; this stops the click closing what the same tap just opened. */
  const openedAt = useRef(0);
  const show = () => {
    if (!open) openedAt.current = Date.now();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  /*
    Once open, measure the bubble and keep it fully on screen: open above the
    label when there isn't room below, and slide sideways off the edges.
  */
  useLayoutEffect(() => {
    if (!open || !bubble.current || !ref.current) return;
    const anchor = ref.current.getBoundingClientRect();
    const rect = bubble.current.getBoundingClientRect();
    const height = rect.height + 8;
    const roomBelow = window.innerHeight - anchor.bottom - GUTTER;
    const roomAbove = anchor.top - GUTTER;
    const above = roomBelow < height && roomAbove > roomBelow;
    const naturalLeft = rect.left - place.shift;
    const maxLeft = window.innerWidth - GUTTER - rect.width;
    const shift = Math.min(0, maxLeft - naturalLeft) + Math.max(0, GUTTER - naturalLeft);
    if (above !== place.above || shift !== place.shift) setPlace({ above, shift });
    if (above ? anchor.top - height < 0 : anchor.bottom + height > window.innerHeight) {
      bubble.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [open, place]);

  return (
    <span
      className="info-tip"
      ref={ref}
      onPointerEnter={(e) => e.pointerType === "mouse" && show()}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        className="info-tip__button"
        aria-label={`What is ${label.toLowerCase()}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => (Date.now() - openedAt.current < 400 ? setOpen(true) : open ? setOpen(false) : show())}
        onFocus={show}
        onBlur={() => setOpen(false)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 7.2v3.6" strokeLinecap="round" />
          <circle cx="8" cy="5.1" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open ? (
        <span
          ref={bubble}
          className={place.above ? "info-tip__bubble info-tip__bubble--above" : "info-tip__bubble"}
          style={place.shift ? { transform: `translateX(${place.shift}px)` } : undefined}
          role="tooltip"
          id={id}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
