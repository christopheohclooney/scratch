import { change, periodWords } from "@/lib/format";
import type { Range } from "@/lib/types";

export function Heading({ line1, line2 }: { line1: string; line2: string }) {
  return (
    <h1 className="heading">
      <span>{line1}</span>
      <span>{line2}</span>
    </h1>
  );
}

export function SectionHead({ eyebrow, title, note }: { eyebrow: string; title?: string; note?: React.ReactNode }) {
  return (
    <div className="section__head">
      <span className="eyebrow">{eyebrow}</span>
      {title ? <h2 className="section__title">{title}</h2> : null}
      {note ? <p className="section__note">{note}</p> : null}
    </div>
  );
}

/*
  Up or down arrow and percentage against the previous period. Green means
  better, red means worse; for bounce rate, down is better.
*/
export function Delta({
  current,
  previous,
  range,
  higherIsBetter = true,
}: {
  current: number | null;
  previous: number | null;
  range: Range;
  higherIsBetter?: boolean;
}) {
  const words = periodWords(range);
  const delta = change(current, previous);
  if (delta === null) return <span className="delta">No figures for {words.previous} to compare</span>;
  const pct = Math.round(Math.abs(delta) * 100);
  if (pct === 0) return <span className="delta">Same as {words.previous}</span>;
  const up = delta > 0;
  const good = up === higherIsBetter;
  return (
    <span className={`delta ${good ? "delta--good" : "delta--bad"}`}>
      <span className="delta__change">
        <span aria-hidden="true">{up ? "▲" : "▼"}</span> {up ? "Up" : "Down"} {pct}%
      </span>
      <span>vs {words.previous}</span>
    </span>
  );
}

export function Tile({
  label,
  value,
  delta,
  hint,
  muted = false,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="card tile">
      <span className="tile__label">{label}</span>
      <span className={muted ? "tile__value tile__value--muted" : "tile__value"}>{value}</span>
      {delta}
      {hint ? <span className="tile__hint">{hint}</span> : null}
    </div>
  );
}

export function SectionError({ what, error }: { what: string; error: string }) {
  return (
    <div className="section-error" role="status">
      Couldn't load {what} right now. The rest of the page is unaffected.
      <p>{error}</p>
    </div>
  );
}

export const NOT_CONNECTED = "Not connected yet";
