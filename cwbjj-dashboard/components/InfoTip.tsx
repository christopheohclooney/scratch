"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
  A small ⓘ that explains a figure. Opens on hover or focus on a computer, and
  on tap on a phone; tapping elsewhere or pressing Escape closes it.
*/
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
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

  return (
    <span className="info-tip" ref={ref} onMouseEnter={show} onMouseLeave={() => setOpen(false)}>
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
        <span className="info-tip__bubble" role="tooltip" id={id}>
          {children}
        </span>
      ) : null}
    </span>
  );
}
