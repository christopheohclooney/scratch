const whole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export const formatNumber = (n: number) => whole.format(n);

/* Small percentages keep one decimal, so 1.4% and 0.6% don't both read as 1%. */
export function formatPercent(share: number | null) {
  if (share === null) return "–";
  const pct = share * 100;
  if (pct > 0 && pct < 10) return `${pct.toFixed(1).replace(/\.0$/, "")}%`;
  return `${Math.round(pct)}%`;
}

export function formatDuration(seconds: number | null) {
  if (seconds === null) return "–";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}m ${rest}s` : `${m}m`;
}

export const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);

/* Percentage change, or null when there's nothing to compare with. */
export const change = (current: number | null, previous: number | null) =>
  current === null || previous === null || previous === 0 ? null : (current - previous) / previous;

export function formatDate(date: string, withWeekday = false) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    weekday: withWeekday ? "short" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

/* Words for the period, used in sentences: "this week" / "last week". */
export const periodWords = (range: 7 | 30) =>
  range === 7
    ? { current: "this week", previous: "last week", currentLabel: "This week", previousLabel: "Last week" }
    : {
        current: "in the last 30 days",
        previous: "the 30 days before",
        currentLabel: "Last 30 days",
        previousLabel: "The 30 days before",
      };
