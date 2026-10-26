"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { formatDate, formatNumber } from "@/lib/format";

interface Point {
  date: string;
  current: number;
  previous: number;
}

const HEIGHT = 220;
const PAD = { top: 30, right: 8, bottom: 28, left: 40 };

/* Rounds the top of the axis to a clean number: 0 / 50 / 100 / 150 / 200. */
function niceMax(max: number) {
  if (max <= 0) return 4;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= max) return m * step;
  return 10 * step;
}

/*
  Daily visits: this period as a white line, the previous period as a grey one.
  The busiest day and the latest day are labelled; hovering (or tapping) shows
  both values for any day.
*/
export function LineChart({
  data,
  currentLabel,
  previousLabel,
}: {
  data: Point[];
  currentLabel: string;
  previousLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = niceMax(Math.max(...data.map((d) => Math.max(d.current, d.previous))));
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const path = (key: "current" | "previous") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70)));

  function onMove(event: React.PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const rel = (event.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))));
  }

  const last = data.length - 1;
  const h = hover;
  const busiest = data.reduce((best, d, i) => (d.current > data[best].current ? i : best), 0);
  /* Label the busiest day unless it would crowd the end label. */
  const showBusiest = busiest !== last && x(last) - x(busiest) > 130 && data[busiest].current > 0;
  const labelX = (i: number) => Math.min(Math.max(x(i), PAD.left + 40), width - PAD.right - 40);

  return (
    <div className="chart" ref={ref}>
      <div className="chart__legend" aria-hidden="true">
        <span className="chart__key">{currentLabel}</span>
        <span className="chart__key" style={{ "--key": "var(--chart-previous)" } as React.CSSProperties}>
          {previousLabel}
        </span>
      </div>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`Daily visits. ${data.map((d) => `${formatDate(d.date)}: ${d.current}`).join(", ")}`}
      >
        <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeWidth={1} />
        {ticks.map((t) => (
          <text key={t} className="axis" x={PAD.left - 10} y={y(t) + 4} textAnchor="end">
            {formatNumber(t)}
          </text>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === last ? (
            <text
              key={d.date}
              className="axis"
              x={x(i)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
            >
              {formatDate(d.date)}
            </text>
          ) : null,
        )}
        {/* Lines draw in from left to right: last period first, then this one. */}
        <motion.path
          d={path("previous")}
          fill="none"
          stroke="var(--chart-previous)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1], delay: 0.15 }}
        />
        <motion.path
          d={path("current")}
          fill="none"
          stroke="var(--chart-current)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1], delay: 0.3 }}
        />
        <circle cx={x(last)} cy={y(data[last].current)} r={4} fill="var(--chart-current)" stroke="var(--surface)" strokeWidth={2} />
        {h === null ? (
          <g className="chart__labels">
            <text x={x(last)} y={y(data[last].current) - 12} textAnchor="end">
              {formatNumber(data[last].current)}
            </text>
            {showBusiest ? (
              <>
                <circle cx={x(busiest)} cy={y(data[busiest].current)} r={4} fill="var(--chart-current)" stroke="var(--surface)" strokeWidth={2} />
                <text x={labelX(busiest)} y={y(data[busiest].current) - 12} textAnchor="middle">
                  {formatNumber(data[busiest].current)} · busiest day
                </text>
              </>
            ) : null}
          </g>
        ) : null}
        {h !== null ? (
          <g>
            <line x1={x(h)} x2={x(h)} y1={PAD.top} y2={y(0)} stroke="var(--text-faint)" strokeWidth={1} />
            <circle cx={x(h)} cy={y(data[h].previous)} r={4} fill="var(--chart-previous)" stroke="var(--surface)" strokeWidth={2} />
            <circle cx={x(h)} cy={y(data[h].current)} r={4} fill="var(--chart-current)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        ) : null}
        <rect
          x={PAD.left}
          y={0}
          width={innerW}
          height={HEIGHT}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {h !== null ? (
        <div
          className="chart__tooltip"
          style={{ left: Math.min(Math.max(x(h), 80), width - 80) }}
          role="status"
        >
          <strong>{formatDate(data[h].date, true)}</strong>
          <br />
          {formatNumber(data[h].current)} visits
          <br />
          <span style={{ color: "var(--text-muted)" }}>
            {formatNumber(data[h].previous)} on the matching day before
          </span>
        </div>
      ) : null}
    </div>
  );
}
