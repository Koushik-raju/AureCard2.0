import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { InboxFeed, type InboxItem } from "@/components/inbox/inbox-feed";
import {
  getActivity,
  getComments,
  getSpaces,
  getTasks,
} from "@/lib/repository";

function toTs(createdAt: string | undefined, when: string): number {
  const t = createdAt ? Date.parse(createdAt) : Number.NaN;
  if (!Number.isNaN(t)) return t;
  const w = Date.parse(when);
  return Number.isNaN(w) ? 0 : w;
}

export default async function InboxPage() {
  const [tasks, comments, activity, spaces] = await Promise.all([
    getTasks(),
    getComments(),
    getActivity(),
    getSpaces(),
  ]);
  const spaceName = new Map(spaces.map((s) => [s.id, s.name]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 3);
  const soonStr = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;

  const items: InboxItem[] = [];

  for (const task of tasks) {
    const owners =
      task.assignees && task.assignees.length > 0
        ? task.assignees
        : task.assignee
          ? [task.assignee]
          : [];
    if (owners.length > 0 && task.status !== "done") {
      items.push({
        id: `assign-${task.id}`,
        kind: "assignment",
        title: task.title,
        detail: `Assigned to ${owners.join(", ")} · ${spaceName.get(task.spaceId) ?? "Workspace"}`,
        href: `/tasks/${task.id}`,
        when: task.dueDate ? `Due ${task.dueDate}` : "No due date",
        ts: task.dueDate ? Date.parse(`${task.dueDate}T00:00:00`) : 0,
      });
    }
    if (
      task.status !== "done" &&
      task.dueDate &&
      task.dueDate <= soonStr
    ) {
      items.push({
        id: `due-${task.id}`,
        kind: "due",
        title: task.title,
        detail:
          task.dueDate < todayStr
            ? `Overdue since ${task.dueDate}`
            : `Due ${task.dueDate}`,
        href: `/tasks/${task.id}`,
        when: task.dueDate,
        ts: Date.parse(`${task.dueDate}T00:00:00`),
      });
    }
  }

  for (const comment of comments) {
    const task = taskById.get(comment.taskId);
    items.push({
      id: `comment-${comment.id}`,
      kind: "comment",
      title: task ? `Re: ${task.title}` : "New comment",
      detail: `${comment.author}: ${comment.text.slice(0, 120)}`,
      href: `/tasks/${comment.taskId}`,
      when: comment.createdAt,
      ts: toTs(comment.createdAt, ""),
    });
  }

  for (const entry of activity.slice(0, 30)) {
    items.push({
      id: `activity-${entry.id}`,
      kind: "activity",
      title: entry.text,
      detail: `${entry.author} · ${entry.when}`,
      href: `/tasks/${entry.taskId}`,
      when: entry.when,
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
