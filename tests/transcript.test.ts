import { describe, expect, it } from "vitest";
import {
  buildNoteSections,
  chunkTranscript,
  cleanLine,
  extractTaskSuggestions,
  formatTurns,
  parseTurns,
  stripSpeakers,
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

describe("conversation turns", () => {
  it("parses speaker-labelled lines and round-trips", () => {
    const text = "Koushik: Let's start the review.\nRashmi: I will update the login screen.";
    const turns = parseTurns(text);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ speaker: "Koushik" });
    expect(formatTurns(turns)).toBe(text);
  });

  it("joins unlabeled continuation lines into the current turn", () => {
    const turns = parseTurns("Asha: First thought.\nStill talking here.");
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toContain("Still talking");
  });

  it("strips speaker labels for summary input", () => {
    expect(stripSpeakers("Asha: Hello world.")).toBe("Hello world.");
  });
});

describe("prepared-note sections", () => {
  const convo = [
    "Koushik: The login screen keeps failing on the second attempt.",
    "Rashmi: I will update the login screen by tomorrow.",
    "Koushik: We decided to go with the View label for the report button.",
    "Rashmi: What did design say about the report colors?",
  ].join("\n");

  it("splits actions, decisions and questions", () => {
    const sections = buildNoteSections(convo);
    expect(sections.actions.some((a) => /login screen/.test(a))).toBe(true);
    expect(sections.decisions.some((d) => /View label/.test(d))).toBe(true);
    expect(sections.questions.length).toBeGreaterThan(0);
    expect(sections.summary.length).toBeGreaterThan(0);
    expect(sections.keyPoints.length).toBeGreaterThan(0);
  });

  it("returns empty sections for empty input", () => {
    expect(buildNoteSections("")).toEqual({
      summary: "",
      keyPoints: [],
      actions: [],
      decisions: [],
      questions: [],
    });
  });
});
