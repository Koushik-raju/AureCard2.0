import { describe, expect, it } from "vitest";
import {
  getDueSoonTasks,
  getDueTodayTasks,
  getOverdueTasks,
  todayKey,
} from "@/lib/due";
import { formatDueDate, formatRelativeTime } from "@/lib/dates";
import { resolveDocType } from "@/lib/doc-type";
import { cascadeDone } from "@/lib/subtask-tree";
import { normalizeTags } from "@/lib/tags";
import type { Task } from "@/lib/types";

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
    spaceId: "s1",
    status: "todo",
    ...overrides,
  } as Task;
}

describe("due helpers (one shared definition)", () => {
  const tasks = [
    task({ id: "overdue", dueDate: "2026-09-10" }),
    task({ id: "today", dueDate: "2026-09-12" }),
    task({ id: "soon", dueDate: "2026-09-15" }),
    task({ id: "later", dueDate: "2026-10-01" }),
    task({ id: "nodate" }),
    task({ id: "done-late", dueDate: "2026-09-01", status: "done" }),
  ];
  const today = "2026-09-12";

  it("splits overdue / today / soon with done excluded", () => {
    expect(getOverdueTasks(tasks, today).map((t) => t.id)).toEqual(["overdue"]);
    expect(getDueTodayTasks(tasks, today).map((t) => t.id)).toEqual(["today"]);
    expect(getDueSoonTasks(tasks, 7, today).map((t) => t.id)).toEqual([
      "today",
      "soon",
    ]);
  });

  it("uses the local timezone for today", () => {
    expect(todayKey(new Date(2026, 8, 12, 23, 59))).toBe("2026-09-12");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-09-23T12:00:00Z");

  it("formats minutes, hours, yesterday and old dates", () => {
    expect(formatRelativeTime("2026-09-23T11:59:30Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-09-23T11:30:00Z", now)).toBe("30m ago");
    expect(formatRelativeTime("2026-09-23T09:00:00Z", now)).toBe("3h ago");
    expect(formatRelativeTime("2026-09-22T12:00:00Z", now)).toBe("Yesterday");
    expect(formatRelativeTime("2026-09-20T12:00:00Z", now)).toBe("3 days ago");
    expect(formatRelativeTime("2026-09-08T11:12:00+00:00", now)).toBe("Sep 8");
  });

  it("falls back to the stored string when there is no timestamp", () => {
    expect(formatRelativeTime(undefined, now)).toBe("");
    expect(formatRelativeTime("Yesterday", now)).toBe("Yesterday");
  });

  it("formats due dates with a year only outside this year", () => {
    expect(formatDueDate("2026-09-15", now)).toBe("Sep 15");
    expect(formatDueDate("2025-09-15", now)).toBe("Sep 15, 2025");
    expect(formatDueDate(undefined, now)).toBe("");
  });
});

describe("resolveDocType", () => {
  it("only calls audio recordings recordings", () => {
    const rec = { kind: "file" as const, recordingType: "thought" as const };
    expect(resolveDocType(rec, [])).toBe("recording");
    expect(
      resolveDocType({ kind: "file" as const }, ["audio/webm"])
    ).toBe("recording");
  });

  it("types images and generic files without a fake waveform", () => {
    expect(resolveDocType({ kind: "file" as const }, ["image/png"])).toBe(
      "image"
    );
    expect(resolveDocType({ kind: "file" as const }, ["application/pdf"])).toBe(
      "file"
    );
    expect(resolveDocType({ kind: "file" as const }, [])).toBe("file");
  });

  it("treats docs and notes as notes", () => {
    expect(resolveDocType({ kind: "doc" as const }, [])).toBe("note");
    expect(resolveDocType({ kind: "note" as const }, [])).toBe("note");
  });
});

describe("cascadeDone", () => {  const items = [
    { id: "p" },
    { id: "c1", parentId: "p" },
    { id: "c2", parentId: "p" },
    { id: "g", parentId: "c1" },
  ];

  it("checking a parent checks the whole subtree", () => {
    const { check, uncheck } = cascadeDone(items, "p", true);
    expect(new Set(check)).toEqual(new Set(["p", "c1", "c2", "g"]));
    expect(uncheck).toEqual([]);
  });

  it("unchecking a child unchecks its ancestors only", () => {
    const { check, uncheck } = cascadeDone(items, "g", false);
    expect(check).toEqual([]);
    expect(new Set(uncheck)).toEqual(new Set(["g", "c1", "p"]));
  });
});

describe("normalizeTags", () => {
  it("lowercases, trims and dedupes", () => {
    expect(normalizeTags(["Bug", " bug ", "Production", "", "BUG"])).toEqual([
      "bug",
      "production",
    ]);
    expect(normalizeTags(undefined)).toEqual([]);
  });
});
