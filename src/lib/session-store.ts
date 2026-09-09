import { useSyncExternalStore } from "react";
import type { TaskStatus } from "@/lib/types";

/**
 * In-memory session store for task status changes.
 * Wired to a real database in a later phase; for now it lets
 * task toggles made anywhere (e.g. a task block inside a document)
 * stay in sync across views within a session.
 */

const listeners = new Set<() => void>();
const statusOverrides: Record<string, TaskStatus> = {};

const subscribeTaskStatus = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getTaskStatusSnapshot = () => statusOverrides;

export function setTaskStatus(id: string, status: TaskStatus) {
  statusOverrides[id] = status;
  listeners.forEach((l) => l());
}

export function useTaskStatusOverrides(): Record<string, TaskStatus> {
  return useSyncExternalStore(
    subscribeTaskStatus,
    getTaskStatusSnapshot,
    getTaskStatusSnapshot
  );
}

export function effectiveStatus(
  status?: TaskStatus,
  override?: TaskStatus
): TaskStatus {
  return override ?? status ?? "todo";
}