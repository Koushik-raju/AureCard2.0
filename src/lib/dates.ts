/**
 * Relative timestamps ("5m ago", "Yesterday") derived from a real timestamp
 * at render time, so feed labels never go stale. Falls back to the stored
 * string when there is no parseable timestamp.
 */
export function formatRelativeTime(
  value: string | undefined,
  now: Date = new Date()
): string {
  if (!value) return "";
  const t = Date.parse(value);
  if (Number.isNaN(t)) return value;
  const diff = now.getTime() - t;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const d = new Date(t);
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Short due-date label ("Sep 15" this year, "Sep 15, 2025" otherwise). */
export function formatDueDate(date?: string, now: Date = new Date()): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
