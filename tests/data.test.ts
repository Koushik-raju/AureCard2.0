import { describe, expect, it } from "vitest";
import {
  documentBlocks,
  documents,
  folders,
  lists,
  projects,
  spaces,
  taskComments,
  tasks,
} from "@/lib/data";
import type { Task } from "@/lib/types";

function uniqueIds<T extends { id: string }>(rows: T[]) {
  return new Set(rows.map((r) => r.id)).size === rows.length;
}

describe("in-memory dataset", () => {
  it("has at least one of each entity", () => {
    expect(spaces.length).toBeGreaterThan(0);
    expect(projects.length).toBeGreaterThan(0);
    expect(tasks.length).toBeGreaterThan(0);
    expect(documents.length).toBeGreaterThan(0);
    expect(taskComments.length).toBeGreaterThan(0);
    expect(folders.length).toBeGreaterThan(0);
    expect(lists.length).toBeGreaterThan(0);
  });

  it("keeps ids unique within each collection", () => {
    expect(uniqueIds(spaces)).toBe(true);
    expect(uniqueIds(projects)).toBe(true);
    expect(uniqueIds(tasks)).toBe(true);
    expect(uniqueIds(documents)).toBe(true);
    expect(uniqueIds(documentBlocks)).toBe(true);
    expect(uniqueIds(folders)).toBe(true);
    expect(uniqueIds(lists)).toBe(true);
  });

  it("references valid parents", () => {
    const spaceIds = new Set(spaces.map((s) => s.id));
    const projectIds = new Set(projects.map((p) => p.id));

    for (const p of projects) {
      if (p.spaceId) expect(spaceIds.has(p.spaceId)).toBe(true);
    }
    for (const s of tasks.map((t) => t.spaceId).filter((x): x is string => Boolean(x))) {
      expect(spaceIds.has(s)).toBe(true);
    }
    for (const p of tasks.map((t) => t.projectId).filter((x): x is string => Boolean(x))) {
      expect(projectIds.has(p)).toBe(true);
    }
    for (const p of folders.map((f) => f.projectId)) {
      expect(projectIds.has(p)).toBe(true);
    }
    for (const l of lists) {
      expect(projectIds.has(l.projectId)).toBe(true);
      if (l.folderId) {
        expect(new Set(folders.map((f) => f.id)).has(l.folderId)).toBe(true);
      }
    }
  });

  it("assigns tasks valid statuses and priorities", () => {
    const statuses = ["todo", "in-progress", "in-review", "done"];
    const priorities = ["low", "medium", "high"];
    for (const t of tasks as Task[]) {
      expect(statuses).toContain(t.status);
      expect(priorities).toContain(t.priority);
    }
  });

  it("keeps ids unique across documents and blocks", () => {
    const allIds = new Set<string>();
    for (const row of [...documents, ...documentBlocks]) {
      expect(allIds.has(row.id)).toBe(false);
      allIds.add(row.id);
    }
  });
});