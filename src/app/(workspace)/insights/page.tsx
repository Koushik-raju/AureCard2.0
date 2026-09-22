import Link from "next/link";
import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { computeInsights } from "@/lib/insights";
import { formatDuration } from "@/lib/note-types";
import {
  getActivity,
  getComments,
  getDocuments,
  getSpaces,
  getTasks,
} from "@/lib/repository";
import type { Task } from "@/lib/types";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h2>
  );
}

function formatShortDate(date?: string) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TaskRow({
  task,
  spaceName,
  showDate,
}: {
  task: Task;
  spaceName: (id: string) => string;
  showDate: boolean;
}) {
  return (
    <li>
      <Link
        href={`/tasks/${task.id}`}
        className="flex items-center gap-3 rounded-sm py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
        <span className="min-w-0 flex-1 truncate text-[15px]">{task.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {showDate && task.dueDate ? formatShortDate(task.dueDate) : spaceName(task.spaceId)}
        </span>
      </Link>
    </li>
  );
}

export default async function InsightsPage() {
  const [tasks, documents, activity, comments, spaces] = await Promise.all([
    getTasks(),
    getDocuments(),
    getActivity(),
    getComments(),
    getSpaces(),
  ]);
  const data = computeInsights({ tasks, documents, activity, comments, spaces });
  const spaceName = (id: string) => data.spaceNames.get(id) ?? "";
  const maxDay = Math.max(1, ...data.weeklyActivity.map((b) => b.count));
  const audioLabel = formatDuration(data.totalAudioSecs) ?? "00:00";

  const stats = [
    { label: "Done", value: `${data.counts.donePct}%`, sub: `${data.counts.done} of ${data.counts.total} tasks` },
    { label: "Open", value: String(data.counts.total - data.counts.done), sub: `${data.counts.todo} to do · ${data.counts.inProgress} in progress · ${data.counts.inReview} in review` },
    { label: "Overdue", value: String(data.overdue.length), sub: data.overdue.length ? "Needs attention" : "All clear" },
    { label: "Audio captured", value: audioLabel, sub: `${data.recentRecordings.length || documents.filter((d) => d.kind === "file").length} recordings · ${data.totalComments} comments` },
  ];

  return (
    <ContentWrap>
      <PageHeader
        eyebrow="Aure"
        title="Insights"
        description="Weekly digests, 7/30-day metrics and open questions raised from your recordings — computed live from your workspace."
      />

      <section aria-label="Snapshot" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 font-serif text-3xl font-medium tracking-tight">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </section>

      <section aria-label="This week" className="mt-8 rounded-xl border border-border bg-card p-5">
        <SectionHeading>This week&apos;s activity</SectionHeading>
        <div className="mt-4 flex h-24 items-end gap-2" role="img" aria-label={`${activity.length} recent activity entries`}>
          {data.weeklyActivity.map((day, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-sm bg-primary/70"
                style={{ height: `${Math.max(4, (day.count / maxDay) * 100)}%` }}
                title={`${day.count} events`}
              />
              <span className="text-[11px] text-muted-foreground">{day.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <section aria-label="Overdue">
          <SectionHeading>Overdue ({data.overdue.length})</SectionHeading>
          {data.overdue.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing overdue.</p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {data.overdue.slice(0, 6).map((t) => (
                <TaskRow key={t.id} task={t} spaceName={spaceName} showDate />
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Due soon">
          <SectionHeading>Due in the next 7 days ({data.dueSoon.length})</SectionHeading>
          {data.dueSoon.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing due this week.</p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {data.dueSoon.slice(0, 6).map((t) => (
                <TaskRow key={t.id} task={t} spaceName={spaceName} showDate />
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <section aria-label="Longest open">
          <SectionHeading>Open longest</SectionHeading>
          {data.longestOpen.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No open tasks.</p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {data.longestOpen.map((t) => (
                <TaskRow key={t.id} task={t} spaceName={spaceName} showDate={false} />
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Recurring topics">
          <SectionHeading>Keeps coming back</SectionHeading>
          {data.topics.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No tagged topics yet.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {data.topics.map((t) => (
                <li
                  key={t.topic}
                  className="rounded-full border border-border bg-card px-3 py-1 text-sm"
                >
                  {t.topic}
                  <span className="ml-1.5 text-xs text-muted-foreground">×{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <section aria-label="Recent recordings">
          <SectionHeading>What stood out — recent recordings</SectionHeading>
          {data.recentRecordings.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No recordings yet. <Link href="/record" className="underline">Record your first</Link>.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {data.recentRecordings.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/docs/${d.id}`}
                    className="block rounded-sm py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block truncate text-[15px]">{d.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {d.summary ?? spaceName(d.spaceId)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Open questions">
          <SectionHeading>Worth your attention — captured, unresolved</SectionHeading>
          {data.openQuestions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing captured and unresolved.</p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {data.openQuestions.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="block rounded-sm py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block truncate text-[15px]">{t.title}</span>
                    {t.quote ? (
                      <span className="mt-0.5 block truncate text-xs italic text-muted-foreground">
                        “{t.quote}”
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ContentWrap>
  );
}
