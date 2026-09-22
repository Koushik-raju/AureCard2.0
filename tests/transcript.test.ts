import { describe, expect, it } from "vitest";
import {
  chunkTranscript,
  cleanLine,
  extractTaskSuggestions,
  summarizeTranscript,
} from "@/lib/transcript";

describe("transcript helpers", () => {
  it("cleans filler words and whitespace", () => {
    expect(cleanLine("  um,  hello   world  ")).toBe("hello world");
    expect(cleanLine("Like, we should ship it")).toBe("we should ship it");
  });

  it("chunks long transcripts without losing text", () => {
    const text = Array.from({ length: 10 }, (_, i) => `Sentence number ${i} about the release plan.`).join("\n");
    const chunks = chunkTranscript(text, 100);
    expect(chunks.join(" ")).toContain("Sentence number 9");
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
  });

  it("extracts commitments as task suggestions", () => {
    const text =
      "The sky is blue and the office was quiet. " +
      "I will update the login screen by tomorrow. " +
      "We need to confirm the report label with Rashmi. " +
      "I will update the login screen by tomorrow.";
    const suggestions = extractTaskSuggestions(text);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toMatch(/login screen/);
  });

  it("returns nothing actionable for plain narration", () => {
    expect(extractTaskSuggestions("The sky is blue. Birds flew south.")).toEqual([]);
  });

  it("summarizes to a one-line preview", () => {
    expect(summarizeTranscript("Short.")).toBe("Short.");
    const long = `${"word ".repeat(100)}end`;
    const summary = summarizeTranscript(long, 50);
    expect(summary.length).toBeLessThanOrEqual(50);
    expect(summary.endsWith("…")).toBe(true);
  });
});
