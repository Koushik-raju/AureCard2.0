import type { DocumentBlock, DocumentRef } from "@/lib/types";
import { buildNoteSections } from "@/lib/transcript";

/**
 * Local extractive Q&A over recordings and notes. No network, no keys:
 * passages are ranked by keyword overlap and quoted back with links.
 * The chunk shape ({ docId, text, score }) is also what a future LLM
 * upgrade would retrieve — see Phase 5 item 31.
 */

export type Passage = { docId: string; text: string; score: number };

const TEXT_TYPES = new Set([
  "paragraph",
  "quote",
  "bulleted",
  "numbered",
  "heading",
  "subheading",
  "callout",
  "checklist",
]);

const STOPWORDS = new Set(
  "a,an,the,of,to,in,on,for,and,or,with,about,what,when,where,which,who,how,why,did,does,was,were,are,is,do,we,you,they,our,your,that,this,those,these,there,here,from,into,find,show,tell,give,any,all,my,our,please,can,could,should,would,have,has,had,been,being,by,at,as,it,its,say,said,discuss,talk,mention,mean,decision,decisions,summary,summarize,notes,note,recording,recordings,meeting,meetings,call,transcript".split(
    ","
  )
);

export function contentKeywords(query: string): string[] {
  const words =
    query.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (STOPWORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/** Top passages for a query across text blocks, best first. */
export function retrievePassages(
  blocks: DocumentBlock[],
  query: string,
  limit = 5
): Passage[] {
  const keys = contentKeywords(query);
  if (keys.length === 0) return [];
  const scored: Passage[] = [];
  for (const b of blocks) {
    if (!TEXT_TYPES.has(b.type)) continue;
    const text = b.text.trim().replace(/\s+/g, " ");
    if (text.length < 8) continue;
    const low = text.toLowerCase();
    let score = 0;
    for (const k of keys) {
      if (low.includes(k)) score += k.length;
    }
    if (score > 0) {
      scored.push({ docId: b.documentId, text, score: score / Math.sqrt(text.length) });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Full transcript-ish text of one document (paragraphs + quotes). */
export function transcriptOfDocument(blocks: DocumentBlock[], docId: string): string {
  return blocks
    .filter(
      (b) =>
        b.documentId === docId &&
        (b.type === "paragraph" || b.type === "quote") &&
        b.text.trim()
    )
    .map((b) => b.text.trim())
    .join("\n");
}

/** Fuzzy title match for "summarize the launch notes"-style queries. */
export function matchDocByTitle(
  docs: DocumentRef[],
  query: string
): DocumentRef | null {
  const parts = query
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length > 2 && !STOPWORDS.has(p));
  if (parts.length === 0) return null;
  const scored = docs
    .map((d) => ({
      doc: d,
      score: parts.filter((p) => d.title.toLowerCase().includes(p)).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.doc ?? null;
}

export type ContentAnswer = {
  text: string;
  suggestions: { label: string; href: string }[];
};

/**
 * Answer "what did we say/decide about X", "find discussion of Y" and
 * "summarize Z" from local blocks. Returns null when there is nothing
 * relevant, so the caller can fall through to its default reply.
 */
export function answerAboutContent(
  blocks: DocumentBlock[],
  docs: DocumentRef[],
  query: string
): ContentAnswer | null {
  const q = query.trim().toLowerCase();
  const docById = new Map(docs.map((d) => [d.id, d]));

  const summarizeHit =
    /\bsummar(y|ise|ize)\b/.test(q) ||
    (/^(tl;dr|recap)\b/.test(q) && /\b(note|doc|recording|meeting|call)\b/.test(q));
  if (summarizeHit) {
    const doc = matchDocByTitle(docs, q);
    if (!doc) return null;
    const sections = buildNoteSections(transcriptOfDocument(blocks, doc.id));
    const bits: string[] = [];
    if (sections.summary) bits.push(sections.summary);
    for (const p of sections.keyPoints.slice(0, 3)) bits.push(`• ${p}`);
    if (sections.actions.length > 0) {
      bits.push(`Action: ${sections.actions[0]}`);
    }
    return {
      text:
        bits.length > 0
          ? `From “${doc.title}”: ${bits.join(" ")}`
          : `“${doc.title}” has no transcript text I can summarize yet.`,
      suggestions: [{ label: doc.title, href: `/docs/${doc.id}` }],
    };
  }

  const discussHit =
    /what did we (say|discuss|talk|decide|agree)|what was (said|decided|discussed|agreed)|find .*?(said|mention|discuss|talk|decision|conclusion)|where .*?(said|mention|discuss|talk)|(discussion|decisions?|concluded|agreed)\b/.test(
      q
    );
  if (!discussHit) return null;
  const passages = retrievePassages(blocks, q, 5);
  if (passages.length === 0) return null;
  return {
    text: `Here's what I found — quoted verbatim, I can't interpret it:`,
    suggestions: passages.map((p) => {
      const title = docById.get(p.docId)?.title ?? "Note";
      const snippet = p.text.length > 90 ? `${p.text.slice(0, 87).trimEnd()}…` : p.text;
      return { label: `${title}: “${snippet}”`, href: `/docs/${p.docId}` };
    }),
  };
}
