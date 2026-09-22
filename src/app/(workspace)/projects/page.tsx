import Link from "next/link";
import { getSpaces, getProjects, getTasks } from "@/lib/repository";
import { CreateProjectButton } from "@/components/create/create-project-form";
import { ProjectMenu } from "@/components/create/entity-menus";
import { accentStyles } from "@/lib/accents";

export default async function ProjectsPage() {
  const [spaces, projects, tasks] = await Promise.all([
    getSpaces(),
    getProjects(),
    getTasks(),
  ]);
  const tasksByProject = new Map<string, number>();
  for (const t of tasks) {
    if (!t.projectId) continue;
    tasksByProject.set(t.projectId, (tasksByProject.get(t.projectId) ?? 0) + 1);
  }
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            Projects
          </h1>
          <p className="mt-2 max-w-prose text-[15px] text-muted-foreground">
            Organised work — each project holds its folders, lists, tasks, and
            documents in one calm place.
          </p>
        </div>
        <CreateProjectButton spaces={spaces} />
      </header>

      {spaces.map((space) => {
        const spaceProjects = projects.filter((p) => p.spaceId === space.id);
        const accent = accentStyles(space.accent);
        if (spaceProjects.length === 0) return null;

        return (
          <section key={space.id} className="mt-10 first-of-type:mt-8">
            <div className="flex items-center gap-2.5">
              <span className={`size-2.5 rounded-full ${accent.dot}`} aria-hidden="true" />
              <h2 className="text-sm font-medium">{space.name}</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {spaceProjects.map((project) => {
                const taskCount = tasksByProject.get(project.id) ?? 0;
                return (
                  <div
                    key={project.id}
                    className="group relative rounded-xl border border-border bg-card p-5 transition-all hover:border-muted-foreground/30 hover:shadow-sm"
                  >
                    <Link
                      href={`/projects/${project.id}`}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                      <h3 className="truncate pr-8 text-base font-medium group-hover:text-primary">
                        {project.name}
                      </h3>
                      {project.description ? (
                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {project.description}
                        </p>
                      ) : null}
                      <div className="mt-4 text-xs text-muted-foreground">
                        {taskCount} tasks
                      </div>
                    </Link>
                    <span className="absolute right-2 top-2">
                      <ProjectMenu
                        projectId={project.id}
                        projectName={project.name}
                        onDeleteRedirect="/projects"
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
