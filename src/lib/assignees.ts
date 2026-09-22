import type { Task } from "@/lib/types";

const MAX_ASSIGNEES = 10;

/** Split a free-text input ("Koushik, Rashmi") into a de-duplicated list. */
export function parseAssignees(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input) ? input : String(input ?? "").split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw) {
    const name = String(part ?? "").trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name.slice(0, 80));
    if (out.length >= MAX_ASSIGNEES) break;
  }
  return out;
}

/** Preferred assignee list for a task (new `assignees` array, legacy `assignee` fallback). */
export function getTaskAssignees(task: Pick<Task, "assignees" | "assignee">): string[] {
  if (Array.isArray(task.assignees) && task.assignees.length > 0) {
    return parseAssignees(task.assignees);
  }
  if (typeof task.assignee === "string" && task.assignee.trim()) {
    return parseAssignees(task.assignee);
  }
  return [];
}

/** Comma-joined form value for inputs. */
export function formatAssignees(list: string[]): string {
  return list.join(", ");
}

/** True when two assignee lists contain the same names (order-insensitive). */
export function assigneesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a.map((x) => x.toLowerCase()));
  return b.every((x) => set.has(x.toLowerCase()));
}
