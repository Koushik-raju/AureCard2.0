import { describe, expect, it } from "vitest";
import { accentStyles } from "@/lib/accents";
import { cn } from "@/lib/utils";
import { formatDuration, noteTypeLabel, recordingTypeLabel } from "@/lib/note-types";

describe("accentStyles", () => {
  it("returns classes for every accent", () => {
    for (const accent of ["orange", "amber", "olive", "clay", "sage", "ink"] as const) {
      const s = accentStyles(accent);
      expect(s.dot).toContain("bg-");
      expect(s.ring).toContain("ring-");
      expect(s.text).toContain("text-");
    }
  });

  it("falls back to ink for unknown accents", () => {
    expect(accentStyles("bad" as never)).toBe(accentStyles("ink"));
  });
});

describe("cn", () => {
  it("joins and dedupes conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("px-2", "py-3")).toBe("px-2 py-3");
  });

  it("ignores falsy values", () => {
    expect(cn("px-2", false, undefined, null, "py-3")).toBe("px-2 py-3");
  });
});

describe("note-types", () => {
  it("formats durations as mm:ss", () => {
    expect(formatDuration(42)).toBe("00:42");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(3600)).toBe("60:00");
    expect(formatDuration(undefined)).toBeNull();
  });

  it("labels note and recording types", () => {
    expect(noteTypeLabel("soap")).toBe("Clinical SOAP note");
    expect(noteTypeLabel("general")).toBe("General");
    expect(recordingTypeLabel("thought")).toBe("Thoughts");
    expect(recordingTypeLabel("meeting")).toBe("Meetings");
  });
});