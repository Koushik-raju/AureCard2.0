import { ExploreTasks } from "@/components/tasks/explore-tasks";
import { CreateTaskButton } from "@/components/create/create-task-form";
import { getCurrentUser } from "@/app/actions/auth";
import {
  getTasks,
  getProjects,
  getSpaces,
  getLists,
  getFolders,
  getTaskItems,
  getDocuments,
  getTaskAttachments,
  getComments,
} from "@/lib/repository";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; project?: string; folder?: string; list?: string }>;
}) {
  const params = await searchParams;
  const [tasks, projects, spaces, lists, folders, taskItems, documents, attachments, comments, user] = await Promise.all([
    getTasks(),
    getProjects(),
    getSpaces(),
    getLists(),
    getFolders(),
    getTaskItems(),
    getDocuments(),
    getTaskAttachments(),
    getComments(),
    getCurrentUser(),
  ]);
  // Derived locally — avoids a second full fetch of the tasks table.
  const counts = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    inProgress: tasks.filter((t) => t.status === "in-progress").length,
    inReview: tasks.filter((t) => t.status === "in-review").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
  const itemsByTask: Record<string, import("@/lib/types").TaskItem[]> = {};
  for (const item of taskItems) {
    (itemsByTask[item.taskId] ??= []).push(item);
  }
  const docTitle = new Map(documents.map((d) => [d.id, d.title] as const));
  const attachmentCounts = new Map<string, number>();
  for (const a of attachments) {
    attachmentCounts.set(a.taskId, (attachmentCounts.get(a.taskId) ?? 0) + 1);
  }
  const commentCounts = new Map<string, number>();
  for (const c of comments) {
    commentCounts.set(c.taskId, (commentCounts.get(c.taskId) ?? 0) + 1);
  }
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            Tasks
          </h1>
          <p className="mt-2 max-w-prose text-[15px] text-muted-foreground">
            Everything that needs doing — filter, focus, and get things moving.
          </p>
        </div>
        <CreateTaskButton spaces={spaces} projects={projects} />
      </header>
      <div className="mt-8">
        <ExploreTasks
          key={`${params.space ?? ""}|${params.project ?? ""}|${params.folder ?? ""}|${params.list ?? ""}`}
          tasks={tasks}
          projects={projects}
          spaces={spaces}
          lists={lists}
          folders={folders}
          counts={counts}
          itemsByTask={itemsByTask}
          currentUserEmail={user?.email}
          docTitle={docTitle}
          attachmentCounts={attachmentCounts}
          commentCounts={commentCounts}
          initialSpaceId={params.space}
          initialProjectId={params.project}
          initialFolderId={params.folder}
          initialListId={params.list}
        />
      </div>
    </div>
  );
}
