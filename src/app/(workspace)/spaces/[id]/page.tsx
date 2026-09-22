import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getSpace,
  getProjectsForSpace,
  getTasksForSpace,
  getDocsForSpace,
  getTaskItems,
} from "@/lib/repository";
import type { TaskItem } from "@/lib/types";
import { CreateProjectButton } from "@/components/create/create-project-form";
import { CreateTaskButton } from "@/components/create/create-task-form";
import { SpaceMenu } from "@/components/create/entity-menus";
import { SpaceHeaderEditor } from "@/components/create/inline-editor";
import { GroupedTaskList } from "@/components/tasks/grouped-task-list";
import { accentStyles } from "@/lib/accents";
import { cn } from "@/lib/utils";

function SectionHeading({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <span className="text-xs text-muted-foreground/60">{count}</span>
    </div>
  );
}

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const space = await getSpace(id);
  if (!space) notFound();

  const [spaceProjects, spaceTasks, spaceDocs, allSpaces, allProjects] =
    await Promise.all([
      getProjectsForSpace(space.id),
      getTasksForSpace(space.id),
      getDocsForSpace(space.id),
      import("@/lib/repository").then((m) => m.getSpaces()),
      import("@/lib/repository").then((m) => m.getProjects()),
    ]);

  const taskItems = await getTaskItems();
  const itemsByTask: Record<string, TaskItem[]> = {};
  for (const item of taskItems) {
    (itemsByTask[item.taskId] ??= []).push(item);
  }

  const accent = accentStyles(space.accent);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-10">
      <nav className="mb-6">
        <Link
          href="/spaces"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft className="size-4" />
          Spaces
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <SpaceHeaderEditor
          spaceId={space.id}
          name={space.name}
          description={space.description}
          marker={<span className={`size-3 rounded-full ${accent.dot}`} aria-hidden="true" />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <CreateTaskButton
                spaces={allSpaces}
                projects={allProjects}
                defaultSpaceId={space.id}
              />
              <CreateProjectButton spaces={allSpaces} defaultSpaceId={space.id} />
              <SpaceMenu
                spaceId={space.id}
                spaceName={space.name}
                onDeleteRedirect="/spaces"
              />
            </div>
          }
        />
      </header>

      <section className="mt-10">
        <SectionHeading title="Projects" count={spaceProjects.length} />
        <ul className="mt-3 divide-y divide-border">
          {spaceProjects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="group flex items-center justify-between gap-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-medium group-hover:text-primary">
                    {project.name}
                  </span>
                  {project.description ? (
                    <span className="truncate text-sm text-muted-foreground">
                      {project.description}
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {spaceTasks.filter((t) => t.projectId === project.id).length}{" "}
                  tasks
                </span>
              </Link>
            </li>
          ))}
          {spaceProjects.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No projects yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeading title="Tasks" count={spaceTasks.length} />
        <GroupedTaskList tasks={spaceTasks} itemsByTask={itemsByTask} />
      </section>

      <section className="mt-10">
        <SectionHeading title="Documents" count={spaceDocs.length} />
        <ul className="mt-3 divide-y divide-border">
          {spaceDocs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-3">
              <span className={cn("size-1.5 shrink-0 rounded-full", accent.dot)} />
              <Link
                href={`/docs/${doc.id}`}
                className="text-[15px] leading-snug hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-colors"
              >
                {doc.title}
              </Link>
              <span className="ml-auto text-xs text-muted-foreground">
                {doc.kind === "note" ? "Note" : doc.kind === "file" ? "File" : "Doc"}
              </span>
            </li>
          ))}
          {spaceDocs.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No documents yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
