import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/server-supabase", () => ({
  createServerSupabase: () => null,
  isDbConfigured: false,
}));

import * as memory from "@/lib/data";
import {
  getCommentsForTask,
  getProjectsForSpace,
  getSpaces,
  getTasksForProject,
  getTasksForSpace,
} from "@/lib/repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("repository (no-db fallback)", () => {
  it("returns the in-memory spaces", async () => {
    const rows = await getSpaces();
    expect(rows).toEqual(memory.spaces);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("filters projects by space", async () => {
    const project = memory.projects.find((p) => p.spaceId) ?? memory.projects[0];
    const rows = await getProjectsForSpace(project.spaceId!);
    expect(rows.every((p) => p.spaceId === project.spaceId)).toBe(true);
  });

  it("filters tasks by space and project", async () => {
    const space = memory.spaces[0];
    const project = memory.projects.find((p) => p.spaceId === space.id) ?? memory.projects[0];
    const bySpace = await getTasksForSpace(space.id);
    expect(bySpace.every((t) => t.spaceId === space.id)).toBe(true);
    const byProject = await getTasksForProject(project.id);
    expect(byProject.every((t) => t.projectId === project.id)).toBe(true);
  });

  it("returns comments for a task", async () => {
    const task = memory.tasks[0];
    const expected = memory.getCommentsForTask(task.id);
    const rows = await getCommentsForTask(task.id);
    expect(rows).toEqual(expected);
  });
});