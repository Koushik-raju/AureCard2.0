import type {
  DocumentRef,
  Space,
  Task,
  TaskActivity,
  TaskComment,
  TaskStatus,
} from "@/lib/types";

export type InsightsInput = {
  tasks: Task[];
  documents: DocumentRef[];
  activity: TaskActivity[];
  comments: TaskComment[];
  spaces: Space[];
  /** Override "today" (ISO date or timestamp) for deterministic tests. */
  now?: string | number | Date;
};

export type StatusCounts = {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
  donePct: number;
};

export type TopicCount = { topic: string; count: number };

export type DayBucket = { label: string; count: number };

export type Insights = {
  counts: StatusCounts;
  overdue: Task[];
  dueSoon: Task[];
  longestOpen: Task[];
  /** Most-used task tags across the workspace. */
  topics: TopicCount[];
  recentRecordings: DocumentRef[];
  /** Captured-from-a-note tasks that are still unresolved. */
  openQuestions: Task[];
  /** Activity entries per day for the last 7 days (oldest → newest). */
  weeklyActivity: DayBucket[];
  totalAudioSecs: number;
  totalComments: number;
  spaceNames: Map<string, string>;
};

function toDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isOverdue(task: Task, today: string): boolean {
  return task.status !== "done" && !!task.dueDate && task.dueDate < today;
}

function isDueSoon(task: Task, today: string, horizon: string): boolean {
  return (
    task.status !== "done" &&
    !!task.dueDate &&
    task.dueDate >= today &&
    task.dueDate <= horizon
  );
}

/** Sort key for "open longest": earliest known start, then due date. */
export function openSortKey(task: Task): string {
  return task.startDate ?? task.dueDate ?? "9999-12-31";
}

function parseWhen(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const t = Date.parse(value);
  return Number.isNaN(t) ? fallback : t;
}

export function computeInsights(input: InsightsInput): Insights {
  const now = input.now ? new Date(input.now) : new Date();
  const today = toDay(now);
  const horizonDate = new Date(now);
  horizonDate.setDate(horizonDate.getDate() + 7);
  const horizon = toDay(horizonDate);

  const counts: StatusCounts = {
    total: input.tasks.length,
    todo: 0,
    inProgress: 0,
    inReview: 0,
    done: 0,
    donePct: 0,
  };
  for (const task of input.tasks) {
    const status: TaskStatus = task.status ?? "todo";
    if (status === "done") counts.done += 1;
    else if (status === "in-progress") counts.inProgress += 1;
    else if (status === "in-review") counts.inReview += 1;
    else counts.todo += 1;
  }
  counts.donePct =
    counts.total === 0 ? 0 : Math.round((counts.done / counts.total) * 100);

  const overdue = input.tasks
    .filter((t) => isOverdue(t, today))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const dueSoon = input.tasks
    .filter((t) => isDueSoon(t, today, horizon))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const longestOpen = input.tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => openSortKey(a).localeCompare(openSortKey(b)))
    .slice(0, 5);

  const tagCounts = new Map<string, number>();
  for (const task of input.tasks) {
    for (const raw of task.tags ?? []) {
      const tag = raw.trim();
      if (!tag) continue;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topics: TopicCount[] = [...tagCounts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, 8);

  const recentRecordings = input.documents
    .filter((d) => d.kind === "file")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 5);

  const openQuestions = input.tasks
    .filter((t) => t.status !== "done" && (t.quote || t.sourceDocId))
    .sort((a, b) => openSortKey(a).localeCompare(openSortKey(b)))
    .slice(0, 5);

  const buckets: DayBucket[] = [];
  const starts: number[] = [];
  const dayMs = 86_400_000;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const dayStart = midnight.getTime() - i * dayMs;
    starts.push(dayStart);
    buckets.push({
      label: new Date(dayStart).toLocaleDateString("en-US", {
        weekday: "narrow",
      }),
      count: 0,
    });
  }
  for (const entry of input.activity) {
    const t = parseWhen(entry.createdAt, Date.parse(entry.when ?? "") || 0);
    if (!t) continue;
    const idx = starts.findIndex((s) => t >= s && t < s + dayMs);
    if (idx !== -1) buckets[idx].count += 1;
  }
  const weeklyActivity: DayBucket[] = buckets;

  const totalAudioSecs = input.documents
    .filter((d) => d.kind === "file")
    .reduce((sum, d) => sum + (d.durationSecs ?? 0), 0);

  return {
    counts,
    overdue,
    dueSoon,
    longestOpen,
    topics,
    recentRecordings,
    openQuestions,
    weeklyActivity,
    totalAudioSecs,
    totalComments: input.comments.length,
    spaceNames: new Map(input.spaces.map((s) => [s.id, s.name])),
  };
}
