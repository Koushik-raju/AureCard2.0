import { describe, expect, it } from "vitest";
import { computeInsights, openSortKey } from "@/lib/insights";
import type {
  DocumentRef,
  Space,
  Task,
  TaskActivity,
  TaskComment,
} from "@/lib/types";

const NOW = new Date("2026-09-21T12:00:00");

const spaces: Space[] = [
  { id: "s1", name: "Work", description: "", accent: "orange" },
];

function task(partial: Partial<Task> & { id: string; title: string }): Task {
  return { spaceId: "s1", status: "todo", ...partial };
}

describe("computeInsights", () => {
  it("counts statuses and done percentage", () => {
    const tasks = [
      task({ id: "a", title: "A", status: "todo" }),
      task({ id: "b", title: "B", status: "done" }),
      task({ id: "c", title: "C", status: "in-progress" }),
      task({ id: "d", title: "D", status: "in-review" }),
    ];
    const out = computeInsights({
      tasks,
      documents: [],
      activity: [],
      comments: [],
      spaces,
      now: NOW,
    });
    expect(out.counts).toMatchObject({
      total: 4,
      todo: 1,
      done: 1,
      inProgress: 1,
      inReview: 1,
      donePct: 25,
    });
  });

  it("finds overdue and due-soon tasks", () => {
    const tasks = [
      task({ id: "late", title: "Late", dueDate: "2026-09-10" }),
      task({ id: "soon", title: "Soon", dueDate: "2026-09-23" }),
      task({ id: "later", title: "Later", dueDate: "2026-10-05" }),
      task({ id: "done-late", title: "Done late", status: "done", dueDate: "2026-09-01" }),
    ];
    const out = computeInsights({
      tasks,
      documents: [],
      activity: [],
      comments: [],
      spaces,
      now: NOW,
    });
    expect(out.overdue.map((t) => t.id)).toEqual(["late"]);
    expect(out.dueSoon.map((t) => t.id)).toEqual(["soon"]);
  });

  it("ranks longest-open tasks by earliest start date", () => {
    const tasks = [
      task({ id: "new", title: "New", startDate: "2026-09-20" }),
      task({ id: "old", title: "Old", startDate: "2026-09-01" }),
      task({ id: "nodate", title: "No date" }),
    ];
    const out = computeInsights({
      tasks,
      documents: [],
      activity: [],
      comments: [],
      spaces,
      now: NOW,
    });
    expect(out.longestOpen.map((t) => t.id)).toEqual(["old", "new", "nodate"]);
    expect(openSortKey(tasks[2])).toBe("9999-12-31");
  });

  it("counts recurring tag topics and open questions", () => {
    const tasks = [
      task({ id: "a", title: "A", tags: ["Bug", "Production"] }),
      task({ id: "b", title: "B", tags: ["Bug"], quote: "it broke" }),
      task({ id: "c", title: "C", status: "done", quote: "fixed" }),
    ];
    const comments: TaskComment[] = [
      { id: "c1", taskId: "a", author: "X", text: "hi", createdAt: "2026-09-20T10:00:00" },
    ];
    const out = computeInsights({
      tasks,
      documents: [],
      activity: [],
      comments,
      spaces,
      now: NOW,
    });
    expect(out.topics).toEqual([
      { topic: "Bug", count: 2 },
      { topic: "Production", count: 1 },
    ]);
    // Only unresolved quoted tasks count; the done one is excluded.
    expect(out.openQuestions.map((t) => t.id)).toEqual(["b"]);
    expect(out.totalComments).toBe(1);
  });

  it("buckets activity into the last 7 days and sums audio", () => {
    const mk = (iso: string, id: string): TaskActivity => ({
      id,
      taskId: "a",
      author: "X",
      text: "did a thing",
      when: iso,
      createdAt: iso,
    });
    const activity = [
      mk("2026-09-21T09:00:00", "today"),
      mk("2026-09-20T09:00:00", "yesterday"),
      mk("2026-09-01T09:00:00", "old"),
    ];
    const documents: DocumentRef[] = [
      { id: "r1", title: "R1", spaceId: "s1", kind: "file", durationSecs: 42, createdAt: "2026-09-21T08:00:00" },
      { id: "d1", title: "D1", spaceId: "s1", kind: "doc" },
    ];
    const out = computeInsights({
      tasks: [],
      documents,
      activity,
      comments: [],
      spaces,
      now: NOW,
    });
    expect(out.weeklyActivity).toHaveLength(7);
    const total = out.weeklyActivity.reduce((n, b) => n + b.count, 0);
    expect(total).toBe(2);
    // Newest bucket is today.
    expect(out.weeklyActivity[6].count).toBe(1);
    expect(out.totalAudioSecs).toBe(42);
    expect(out.recentRecordings.map((d) => d.id)).toEqual(["r1"]);
  });

  it("handles empty input without crashing", () => {
    const out = computeInsights({
      tasks: [],
      documents: [],
      activity: [],
      comments: [],
      spaces: [],
      now: NOW,
    });
    expect(out.counts.donePct).toBe(0);
    expect(out.overdue).toEqual([]);
    expect(out.topics).toEqual([]);
  });
});
