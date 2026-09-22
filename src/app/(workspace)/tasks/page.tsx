import { ExploreTasks } from "@/components/tasks/explore-tasks";
import { CreateTaskButton } from "@/components/create/create-task-form";
import { getCurrentUser } from "@/app/actions/auth";
import {
  getTasks,
  getProjects,
  getSpaces,
  getTaskStatusCounts,
  getTaskItems,
  getDocuments,
} from "@/lib/repository";

export default async function TasksPage() {
  const [tasks, projects, spaces, counts, taskItems, documents, user] = await Promise.all([
    getTasks(),
    getProjects(),
    getSpaces(),
    getTaskStatusCounts(),
    getTaskItems(),
    getDocuments(),
    getCurrentUser(),
  ]);
  const itemsByTask: Record<string, import("@/lib/types").TaskItem[]> = {};
  for (const item of taskItems) {
    (itemsByTask[item.taskId] ??= []).push(item);
  }
  const docTitle = new Map(documents.map((d) => [d.id, d.title] as const));
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
        <ExploreTasks tasks={tasks} projects={projects} spaces={spaces} counts={counts} itemsByTask={itemsByTask} currentUserEmail={user?.email} docTitle={docTitle} />
      </div>
    </div>
  );
}
