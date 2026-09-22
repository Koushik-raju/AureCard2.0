import type { DocumentRef, Space, Task } from "@/lib/types";

export type Department = {
  id: string;
  name: string;
  /** Space this department rolls up, or "" for the whole workspace. */
  spaceId: string;
};

export type Member = {
  id: string;
  name: string;
  role: string;
  departmentId: string;
};

export type OrgChart = {
  departments: Department[];
  members: Member[];
};

export const EMPTY_ORG: OrgChart = { departments: [], members: [] };

export function newOrgId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export type DepartmentDigest = {
  department: Department;
  scopeName: string;
  members: Member[];
  totalTasks: number;
  openTasks: number;
  doneTasks: number;
  docs: number;
};

export function memberWorkload(memberName: string, tasks: Task[]): number {
  const needle = memberName.trim().toLowerCase();
  if (!needle) return 0;
  return tasks.filter(
    (t) => t.status !== "done" && (t.assignee ?? "").trim().toLowerCase() === needle
  ).length;
}

export function computeDigests(
  org: OrgChart,
  tasks: Task[],
  documents: DocumentRef[],
  spaces: Space[]
): DepartmentDigest[] {
  const spaceName = new Map(spaces.map((s) => [s.id, s.name]));
  return org.departments.map((department) => {
    const inScopeTasks = department.spaceId
      ? tasks.filter((t) => t.spaceId === department.spaceId)
      : tasks;
    const inScopeDocs = department.spaceId
      ? documents.filter((d) => d.spaceId === department.spaceId)
      : documents;
    const done = inScopeTasks.filter((t) => t.status === "done").length;
    return {
      department,
      scopeName: department.spaceId
        ? (spaceName.get(department.spaceId) ?? "Unknown space")
        : "Whole workspace",
      members: org.members.filter((m) => m.departmentId === department.id),
      totalTasks: inScopeTasks.length,
      openTasks: inScopeTasks.length - done,
      doneTasks: done,
      docs: inScopeDocs.length,
    };
  });
}
