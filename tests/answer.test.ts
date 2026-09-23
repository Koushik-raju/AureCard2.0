import { describe, expect, it } from "vitest";
import {
  answerAboutContent,
  matchDocByTitle,
  retrievePassages,
} from "@/lib/answer";
import type { DocumentBlock, DocumentRef } from "@/lib/types";

const docs: DocumentRef[] = [
  { id: "d1", title: "Launch sync", spaceId: "s1", kind: "note" },
  { id: "d2", title: "Grocery list", spaceId: "s1", kind: "note" },
];

function block(
  id: string,
  documentId: string,
  type: DocumentBlock["type"],
  text: string
): DocumentBlock {
  return { id, documentId, type, text };
}

const blocks: DocumentBlock[] = [
  block("b1", "d1", "paragraph", "Koushik: We decided to go with the View label."),
  block("b2", "d1", "paragraph", "Rashmi: I will update the login screen by tomorrow."),
  block("b3", "d2", "paragraph", "Buy milk and eggs."),
  block("b4", "d1", "divider", ""),
];

describe("retrievePassages", () => {
  it("ranks keyword-matching text blocks first", () => {
    const out = retrievePassages(blocks, "View label decision");
    expect(out[0].docId).toBe("d1");
    expect(out[0].text).toMatch(/View label/);
  });

  it("ignores non-text blocks and returns nothing without keywords", () => {
    expect(retrievePassages(blocks, "what did we")).toEqual([]);
    expect(retrievePassages(blocks, "")).toEqual([]);
  });
});

describe("matchDocByTitle", () => {
  it("finds a doc by title words", () => {
    expect(matchDocByTitle(docs, "summarize the launch sync")?.id).toBe("d1");
    expect(matchDocByTitle(docs, "summarize nothing here xyz")).toBeNull();
  });
});

describe("answerAboutContent", () => {
  it("answers what-was-decided with quoted passages and links", () => {
    const answer = answerAboutContent(blocks, docs, "what did we decide about the label?");
    expect(answer).not.toBeNull();
    expect(answer!.suggestions.length).toBeGreaterThan(0);
    expect(answer!.suggestions[0].href).toBe("/docs/d1");
  });

  it("summarizes a named recording from its transcript", () => {
    const answer = answerAboutContent(blocks, docs, "summarize the launch sync");
    expect(answer).not.toBeNull();
    expect(answer!.suggestions).toEqual([{ label: "Launch sync", href: "/docs/d1" }]);
    expect(answer!.text).toMatch(/Launch sync/);
  });

  it("returns null when nothing matches, so callers fall through", () => {
    expect(answerAboutContent(blocks, docs, "what should i focus on?")).toBeNull();
    expect(answerAboutContent(blocks, docs, "how many tasks?")).toBeNull();
    expect(
      answerAboutContent(blocks, docs, "what did we say about purple elephants?")
    ).toBeNull();
  });
});
