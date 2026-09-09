import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getDocument,
  getBlocksForDocument,
  getTasks,
  getSpace,
  getProject,
  getTasksForDocument,
} from "@/lib/repository";
import { accentStyles } from "@/lib/accents";
import { BlockEditor } from "@/components/docs/block-editor";
import { LinkedTaskChip } from "@/components/docs/linked-task-chip";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await getDocument(id);
  if (!document) notFound();

  const [space, project, blocks, linkedTasks, allTasks] = await Promise.all([
    getSpace(document.spaceId),
    document.projectId
      ? getProject(document.projectId)
      : Promise.resolve(undefined),
    getBlocksForDocument(id),
    getTasksForDocument(id),
    getTasks(),
  ]);
  const accent = accentStyles(space?.accent ?? "ink");

  const taskTitles: Record<string, string> = {};
  const tasksById = new Map(allTasks.map((t) => [t.id, t]));
  for (const block of blocks) {
    if (block.taskId) {
      const task = tasksById.get(block.taskId);
      if (task) taskTitles[task.id] = task.title;
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 sm:py-10">
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft className="size-4" />
          Docs
        </Link>
        {project ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              href={`/projects/${project.id}`}
              className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {project.name}
            </Link>
          </>
        ) : null}
        {space ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              href={`/spaces/${space.id}`}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <span className={`size-2 rounded-full ${accent.dot}`} aria-hidden="true" />
              {space.name}
            </Link>
          </>
        ) : null}
      </nav>

      <header className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          {document.title}
        </h1>
        <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          {document.kind === "note" ? "Note" : "Doc"}
        </span>
      </header>

      {linkedTasks.length > 0 ? (
        <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="uppercase tracking-[0.14em] text-[11px] text-muted-foreground">
            Linked tasks
          </span>
          {linkedTasks.map((task) => (
            <LinkedTaskChip key={task.id} task={task} />
          ))}
        </p>
      ) : null}

      <div className="mt-8">
        <BlockEditor
          documentId={document.id}
          initialBlocks={blocks}
          taskTitles={taskTitles}
        />
      </div>
    </div>
  );
}