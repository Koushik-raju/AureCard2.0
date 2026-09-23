/**
 * Tags are stored lowercase + trimmed + de-duplicated so "Bug" and "bug"
 * never split into separate topics. Display keeps the stored form.
 */
export function normalizeTags(tags?: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const t = String(raw ?? "").trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
