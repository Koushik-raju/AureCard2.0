import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { InboxFeed, type InboxItem } from "@/components/inbox/inbox-feed";
import { getCurrentUser } from "@/app/actions/auth";
import {
  getActivity,
  getComments,
  getSpaces,
  getTasks,
} from "@/lib/repository";
import { formatDueDate, formatRelativeTime } from "@/lib/dates";
import { getDueSoonTasks, getOverdueTasks, todayKey } from "@/lib/due";

function toTs(createdAt: string | undefined, when: string): number {
  const t = createdAt ? Date.parse(createdAt) : Number.NaN;
  if (!Number.isNaN(t)) return t;
  const w = Date.parse(when);
  return Number.isNaN(w) ? 0 : w;
}

export default async function InboxPage() {
  const [tasks, comments, activity, spaces, user] = await Promise.all([
    getTasks(),
    getComments(),
    getActivity(),
    getSpaces(),
    getCurrentUser(),
  ]);
  const spaceName = new Map(spaces.map((s) => [s.id, s.name]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const me = user?.email?.toLowerCase() ?? "";
  const isMe = (author: string) => {
    if (!me) return false;
    const a = author.trim().toLowerCase();
    return a === me || a === me.split("@")[0];
  };

  const today = todayKey();
  const overdueById = new Map(getOverdueTasks(tasks, today).map((t) => [t.id, t]));
  const dueSoonById = new Map(getDueSoonTasks(tasks, 3, today).map((t) => [t.id, t]));

  const items: InboxItem[] = [];

  for (const task of tasks) {
    if (task.status === "done") continue;
    const owners =
      task.assignees && task.assignees.length > 0
        ? task.assignees
        : task.assignee
          ? [task.assignee]
          : [];
    const dated = overdueById.get(task.id) ?? dueSoonById.get(task.id);
    const dueLabel = dated
      ? overdueById.has(task.id)
        ? `Overdue since ${formatDueDate(task.dueDate)}`
        : `Due ${formatDueDate(task.dueDate)}`
      : null;
    // One item per task: assignment and due date are merged, never doubled.
    if (owners.length > 0) {
      items.push({
        id: `assign-${task.id}`,
        kind: "assignment",
        title: task.title,
        detail: [`Assigned to ${owners.join(", ")}`, dueLabel, spaceName.get(task.spaceId) ?? "Workspace"]
          .filter(Boolean)
          .join(" · "),
        href: `/tasks/${task.id}`,
        when: dueLabel ?? "No due date",
        ts: task.dueDate ? Date.parse(`${task.dueDate}T00:00:00`) : 0,
      });
    } else if (dated && dueLabel) {
      items.push({
        id: `due-${task.id}`,
        kind: "due",
        title: task.title,
        detail: `${dueLabel} · ${spaceName.get(task.spaceId) ?? "Workspace"}`,
        href: `/tasks/${task.id}`,
        when: dueLabel ?? "",
        ts: task.dueDate ? Date.parse(`${task.dueDate}T00:00:00`) : 0,
      });
    }
  }

  for (const comment of comments) {
    if (isMe(comment.author)) continue;
    const task = taskById.get(comment.taskId);
    items.push({
      id: `comment-${comment.id}`,
      kind: "comment",
      title: task ? `Re: ${task.title}` : "New comment",
      detail: `${comment.author}: ${comment.text.slice(0, 120)}`,
      href: `/tasks/${comment.taskId}`,
      when: formatRelativeTime(comment.createdAt),
      ts: toTs(comment.createdAt, ""),
    });
  }

  for (const entry of activity.slice(0, 30)) {
    if (isMe(entry.author)) continue;
    const task = taskById.get(entry.taskId);
    items.push({
      id: `activity-${entry.id}`,
      kind: "activity",
      title: entry.text,
      detail: task ? `${entry.author} · ${task.title}` : entry.author,
      href: `/tasks/${entry.taskId}`,
      when: entry.createdAt ? formatRelativeTime(entry.createdAt) : entry.when,
      ts: toTs(entry.createdAt, entry.when),
    });
  }

  items.sort((a, b) => b.ts - a.ts);
  const feed = items.slice(0, 60);

  return (
    <ContentWrap>
      <PageHeader
        eyebrow="Collaboration"
        title="Inbox"
        description="While you were away — task assignments, comments, due dates and space activity."
      />
      <InboxFeed items={feed} />
    </ContentWrap>
  );
}
