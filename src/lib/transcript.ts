/**
 * Transcript helpers for the in-browser recording pipeline. Everything runs
 * locally: chunking for display/storage and a lightweight heuristic that
 * surfaces likely commitments ("I will …", "need to …") as task suggestions.
 */

const ACTION_PATTERN =
  /\b(will|need to|needs to|should|must|todo|action item|follow[ -]?up|remember to|make sure|don't forget|do not forget|let's|lets|assign(?:ed)?|deadline|plan to|have to|going to)\b/i;

const FILLER_PATTERN =
  /^(um+|uh+|er+|ah+|like|you know)[,.\s]+/i;

export function cleanLine(line: string): string {
  return line.trim().replace(/\s+/g, " ").replace(FILLER_PATTERN, "").trim();
}

/** Split a transcript into display/storage chunks of at most maxLen chars. */
export function chunkTranscript(text: string, maxLen = 1200): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => cleanLine(l))
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (!current) {
      current = line;
      continue;
    }
    if ((current + " " + line).length <= maxLen) {
      current = `${current} ${line}`;
    } else {
      chunks.push(current);
      current = line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => cleanLine(s))
    .filter((s) => s.length >= 12);
}

/**
 * Heuristic commitment extraction: sentences that sound like something
 * someone agreed to do. Returns at most `limit` suggestions, longest likely
 * commitments first, de-duplicated.
 */
export function extractTaskSuggestions(text: string, limit = 6): string[] {
  const seen = new Set<string>();
  const scored: { sentence: string; score: number }[] = [];
  for (const sentence of splitSentences(text)) {
    if (!ACTION_PATTERN.test(sentence)) continue;
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let score = sentence.length;
    if (/\bby (tomorrow|monday|tuesday|wednesday|thursday|friday|next week|eod|friday)\b/i.test(sentence)) score += 60;
    if (/^(i will|we('ll| will)|let's|action item)/i.test(sentence)) score += 40;
    scored.push({ sentence, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ sentence }) =>
      sentence.length > 140 ? `${sentence.slice(0, 137).trimEnd()}…` : sentence
    );
}

/** One-line preview for recording cards. */
export function summarizeTranscript(text: string, maxLen = 220): string {
  const clean = cleanLine(text);
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}
