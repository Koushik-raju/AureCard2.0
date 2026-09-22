import { HistoryTimeline } from "@/components/history/history-timeline";
import { getActivity, getTasks, getSpaces, getProjects } from "@/lib/repository";

export default async function HistoryPage() {
  const [activity, tasks, spaces, projects] = await Promise.all([
    getActivity(),
    getTasks(),
    getSpaces(),
    getProjects(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          History
        </h1>
        <p className="mt-2 max-w-prose text-[15px] text-muted-foreground">
          A read-only timeline of everything that happened across your workspace.
        </p>
      </header>
      <HistoryTimeline activity={activity} tasks={tasks} spaces={spaces} projects={projects} />
    </div>
  );
}