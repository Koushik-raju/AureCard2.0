import type { Task } from "@/lib/types";

/** Local-day key `YYYY-MM-DD` for a date (same timezone used to display dates). */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Local "today" key, overridable for tests. */
export function todayKey(now: Date = new Date()): string {
  return localDayKey(now);
}

/** Local day key `days` after the given date (default today). */
export function addLocalDays(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return localDayKey(d);
}

function isOpen(task: Task): boolean {
  return task.status !== "done";
}

/** Open tasks with a due date strictly before today. */
export function isOverdueTask(task: Task, today: string = todayKey()): boolean {
  return isOpen(task) && !!task.dueDate && task.dueDate < today;
}

/** Open tasks due exactly today. */
export function isDueTodayTask(task: Task, today: string = todayKey()): boolean {
  return isOpen(task) && task.dueDate === today;
}

/** Open tasks due within `days` days from today (inclusive, overdue excluded). */
export function isDueSoonTask(
  task: Task,
  days = 7,
  today: string = todayKey()
): boolean {
  if (!isOpen(task) || !task.dueDate) return false;
  return task.dueDate >= today && task.dueDate <= addLocalDays(days);
}

/** Open + overdue, oldest first. */
export function getOverdueTasks(tasks: Task[], today: string = todayKey()): Task[] {
  return tasks
    .filter((t) => isOverdueTask(t, today))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

/** Open + due today, by due date. */
export function getDueTodayTasks(tasks: Task[], today: string = todayKey()): Task[] {
  return tasks
    .filter((t) => isDueTodayTask(t, today))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

/** Open + due within `days` days (inclusive, overdue excluded), soonest first. */
export function getDueSoonTasks(
  tasks: Task[],
  days = 7,
  today: string = todayKey()
): Task[] {
  return tasks
    .filter((t) => isDueSoonTask(t, days, today))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}
