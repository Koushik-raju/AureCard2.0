import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import {
  getSpace,
  getProjectsForSpace,
  getTasksForSpace,
  getDocsForSpace,
} from "@/lib/repository";
import { CreateProjectButton } from "@/components/create/create-project-form";
import { CreateTaskButton } from "@/components/create/create-task-form";
import { accentStyles } from "@/lib/accents";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
};

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

  const accent = accentStyles(space.accent);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 sm:py-10">
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
        <div>
          <div className="flex items-center gap-3">
            <span className={`size-3 rounded-full ${accent.dot}`} aria-hidden="true" />
            <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
              {space.name}
            </h1>
          </div>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
            {space.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreateTaskButton
            spaces={allSpaces}
            projects={allProjects}
            defaultSpaceId={space.id}
          />
          <CreateProjectButton spaces={allSpaces} />
        </div>
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
        <ul className="mt-3 divide-y divide-border">
          {spaceTasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 py-3">
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                  task.status === "done"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40"
                )}
                aria-hidden="true"
              >
                {task.status === "done" ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : null}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "truncate text-[15px] leading-snug",
                    task.status === "done" && "text-muted-foreground line-through"
                  )}
                >
                  {task.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABEL[task.status]}
                  {task.priority ? ` · ${task.priority}` : ""}
                </span>
              </div>
              {task.dueDate ? (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              ) : null}
            </li>
          ))}
          {spaceTasks.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No tasks yet.</li>
          ) : null}
        </ul>
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
                {doc.kind === "note" ? "Note" : "Doc"}
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
