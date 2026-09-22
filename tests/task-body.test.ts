import { describe, expect, it } from "vitest";
import {
  blockHasContent,
  bodyToPlainText,
  isDividerShortcut,
  isEmptyBody,
  matchMarkdownShortcut,
  parseTaskBody,
  serializeTaskBody,
} from "@/lib/task-body";

describe("task body", () => {
  it("round-trips blocks through serialize/parse", () => {
    const blocks = [
      { id: "a", type: "h1" as const, text: "Title", color: "red" as const },
      { id: "b", type: "text" as const, text: "Body text", bg: "yellow" as const },
      { id: "c", type: "image" as const, text: "https://x/y.png", width: 60 },
      { id: "d", type: "checklist" as const, text: "Do it", checked: true },
      {
        id: "e",
        type: "toggle" as const,
        text: "More",
        collapsed: true,
        children: [{ id: "e1", type: "text" as const, text: "Hidden" }],
      },
      {
        id: "f",
        type: "table" as const,
        text: "",
        tableData: [["A", "B"], ["1", "2"]],
      },
      { id: "g", type: "audio" as const, text: "https://x/s.mp3" },
      { id: "h", type: "file" as const, text: "https://x/d.pdf", label: "spec.pdf" },
    ];
    const parsed = parseTaskBody(serializeTaskBody(blocks));
    expect(parsed).toEqual(blocks);
    expect(bodyToPlainText(parsed)).toContain("Hidden");
    expect(bodyToPlainText(parsed)).toContain("A | B");
  });

  it("turns legacy plain text into text blocks", () => {
    const parsed = parseTaskBody("First paragraph.\n\nSecond paragraph.");
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ type: "text", text: "First paragraph." });
    expect(serializeTaskBody(parsed)).toContain("First paragraph.");
  });

  it("treats empty input as an empty editable body", () => {
    expect(parseTaskBody("")).toHaveLength(1);
    expect(parseTaskBody(undefined)).toHaveLength(1);
    expect(isEmptyBody(parseTaskBody(""))).toBe(true);
    expect(serializeTaskBody(parseTaskBody(""))).toBe("");
  });

  it("drops unknown block types and colors instead of crashing", () => {
    const parsed = parseTaskBody(
      JSON.stringify({
        v: 1,
        blocks: [
          { id: "x", type: "unknown", text: "hi" },
          { id: "y", type: "text", text: "ok", color: "neon" },
        ],
      })
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe("text");
    expect(parsed[0].text).toBe("ok");
    expect(parsed[0].color).toBeUndefined();
  });

  it("clamps media width and renders plain text previews", () => {
    const parsed = parseTaskBody(
      JSON.stringify({ v: 1, blocks: [{ id: "x", type: "image", text: "u", width: 500 }] })
    );
    expect(parsed[0].width).toBe(100);
    expect(bodyToPlainText(parsed)).toBe("");
  });

  it("matches markdown shortcuts", () => {
    expect(matchMarkdownShortcut("# ")).toEqual({ type: "h1" });
    expect(matchMarkdownShortcut("## ")).toEqual({ type: "h2" });
    expect(matchMarkdownShortcut("### ")).toEqual({ type: "h3" });
    expect(matchMarkdownShortcut("#### ")).toEqual({ type: "h4" });
    expect(matchMarkdownShortcut("##### ")).toBeNull();
    expect(matchMarkdownShortcut("- ")).toEqual({ type: "bulleted" });
    expect(matchMarkdownShortcut("* ")).toEqual({ type: "bulleted" });
    expect(matchMarkdownShortcut("1. ")).toEqual({ type: "numbered" });
    expect(matchMarkdownShortcut("[] ")).toEqual({ type: "checklist" });
    expect(matchMarkdownShortcut("> ")).toEqual({ type: "quote" });
    expect(matchMarkdownShortcut("``` ")).toEqual({ type: "code" });
    expect(matchMarkdownShortcut("hello ")).toBeNull();
    expect(isDividerShortcut("---")).toBe(true);
    expect(isDividerShortcut("-- ")).toBe(false);
  });

  it("knows which blocks visibly hold content", () => {
    expect(blockHasContent({ id: "a", type: "text", text: "" })).toBe(false);
    expect(blockHasContent({ id: "a", type: "text", text: "hi" })).toBe(true);
    expect(blockHasContent({ id: "a", type: "divider", text: "" })).toBe(true);
    expect(blockHasContent({ id: "a", type: "image", text: "" })).toBe(false);
    expect(
      blockHasContent({ id: "a", type: "toggle", text: "", children: [] })
    ).toBe(false);
  });
});
