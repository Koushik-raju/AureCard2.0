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

/* ------------------------------------------------------------------ */
/* Speaker turns (conversation recordings)                             */
/* ------------------------------------------------------------------ */

export type Turn = { speaker: string; text: string };

const SPEAKER_PREFIX = /^([^:\n]{1,32}):\s*(.*)$/;

/** Parse "Speaker: text" lines back into turns; unlabeled lines join the current turn. */
export function parseTurns(text: string): Turn[] {
  const turns: Turn[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim().replace(/\s+/g, " ");
    if (!line) continue;
    const m = line.match(SPEAKER_PREFIX);
    // Only treat it as a label when the name looks like one (short, no sentence).
    if (m && m[2] && !/[.!?]$/.test(m[1]) && m[1].split(/\s+/).length <= 3) {
      turns.push({ speaker: m[1].trim(), text: cleanLine(m[2]) });
    } else if (turns.length > 0) {
      const last = turns[turns.length - 1];
      last.text = cleanLine(`${last.text} ${line}`);
    } else {
      turns.push({ speaker: "", text: cleanLine(line) });
    }
  }
  return turns.filter((t) => t.text || t.speaker);
}

/** Serialize turns for storage ("Speaker: text" per line). */
export function formatTurns(turns: Turn[]): string {
  return turns
    .map((t) => {
      const text = cleanLine(t.text);
      const speaker = t.speaker.trim().replace(/\s+/g, " ").slice(0, 32);
      if (!text) return "";
      return speaker ? `${speaker}: ${text}` : text;
    })
    .filter(Boolean)
    .join("\n");
}

/** Plain speech without speaker labels (for summary / task extraction). */
export function stripSpeakers(text: string): string {
  return parseTurns(text)
    .map((t) => t.text)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Speaker roster (one central list; turns reference it by name)       */
/* ------------------------------------------------------------------ */

/** Ordered unique speaker names across turns plus explicitly added extras. */
export function rosterOf(turns: Turn[], extra: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 32);
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    out.push(name);
  };
  for (const t of turns) push(t.speaker);
  for (const n of extra) push(n);
  return out;
}

/** Rename a speaker across all turns (rename-to-existing merges them). */
export function renameSpeakerInTurns(
  turns: Turn[],
  oldName: string,
  newName: string
): Turn[] {
  const from = oldName.trim().toLowerCase();
  const to = newName.trim().replace(/\s+/g, " ").slice(0, 32);
  if (!from || !to) return turns;
  return turns.map((t) =>
    t.speaker.trim().toLowerCase() === from ? { ...t, speaker: to } : t
  );
}

/** Next speaker after `last`, cycling the roster (never invents "Speaker 3+"). */
export function cycleSpeaker(roster: string[], last: string): string {
  if (roster.length === 0) return "Speaker 1";
  if (roster.length === 1) {
    return roster[0].toLowerCase() === "speaker 1" ? "Speaker 2" : "Speaker 1";
  }
  const i = roster.findIndex(
    (n) => n.toLowerCase() === last.trim().toLowerCase()
  );
  return roster[(i + 1) % roster.length];
}

/* ------------------------------------------------------------------ */
/* Prepared-note sections (extractive, fully local)                    */
/* ------------------------------------------------------------------ */

const DECISION_PATTERN =
  /\b(decided|agreed|concluded|conclusion|resolution|resolved|final(ly)?|we'll go with|go with|approved|confirmed|settled on)\b/i;

const QUESTION_WORDS = /^(who|what|when|where|why|how|which|whom|whose|can|could|should|would|will|is|are|do|does|did)\b/i;

export type NoteSections = {
  summary: string;
  keyPoints: string[];
  actions: string[];
  decisions: string[];
  questions: string[];
};

function topSentences(text: string, limit: number, skip: (s: string) => boolean): string[] {
  const freq = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  const scored = splitSentences(text)
    .filter((s) => !skip(s))
    .map((s) => {
      const words = s.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [];
      const score = words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.sqrt(words.length || 1);
      return { s, score };
    })
    .sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { s } of scored) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.length > 180 ? `${s.slice(0, 177).trimEnd()}…` : s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Build structured note sections from a (possibly speaker-labelled) transcript. */
export function buildNoteSections(transcript: string): NoteSections {
  const plain = stripSpeakers(transcript);
  const sentences = splitSentences(plain);
  const actions = extractTaskSuggestions(plain, 8);
  const actionSet = new Set(actions.map((a) => a.toLowerCase()));
  const decisions = sentences.filter((s) => DECISION_PATTERN.test(s) && !actionSet.has(s.toLowerCase())).slice(0, 6);
  const decisionSet = new Set(decisions.map((s) => s.toLowerCase()));
  const questions = sentences
    .filter((s) => s.endsWith("?") || QUESTION_WORDS.test(s))
    .filter((s) => !actionSet.has(s.toLowerCase()) && !decisionSet.has(s.toLowerCase()))
    .slice(0, 6);
  const skip = (s: string) => {
    const k = s.toLowerCase();
    return actionSet.has(k) || decisionSet.has(k);
  };
  return {
    summary: summarizeTranscript(plain, 280),
    keyPoints: topSentences(plain, 6, skip),
    actions,
    decisions,
    questions,
  };
}
