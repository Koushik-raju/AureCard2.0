import Link from "next/link";
import {
  getTasks,
  getActivity,
  getDocuments,
  getSpaces,
} from "@/lib/repository";

function formatGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const dateString = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());

function HourStrip() {
  const now = new Date();
  const hour = now.getHours();
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
  });
  const start = Math.max(0, hour - 3);
  const hours = Array.from({ length: 12 }, (_, i) => start + i).filter((h) => h < 24);

  return (
    <div className="flex items-end gap-5 overflow-x-auto pb-1" aria-label="Today&apos;s hours">
      {hours.map((h) => {
        const active = h === hour;
        return (
          <div key={h} className="flex min-w-9 flex-col items-center gap-1.5">
            <span
              className={
                active
                  ? "flex h-9 min-w-9 items-center justify-center whitespace-nowrap rounded-full bg-primary px-1.5 text-[11px] font-medium tabular-nums text-primary-foreground"
                  : "text-[11px] tabular-nums text-muted-foreground"
              }
            >
              {fmt.format(new Date(now.getFullYear(), now.getMonth(), now.getDate(), h))}
            </span>
            <span
              className={
                active
                  ? "h-8 w-px bg-primary"
                  : "h-4 w-px bg-border"
              }
            />
          </div>
        );
      })}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h2>
  );
}

type Item = {
  id: string;
  title: string;
  meta: string;
  href: string;
};

function ListCard({ items, accent }: { items: Item[]; accent?: string }) {
  if (items.length === 0) {
    return (
      <p className="mt-3 py-3 text-sm text-muted-foreground">Nothing here yet.</p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="flex items-center gap-3 rounded-sm py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {accent ? (
              <span className={`size-1.5 shrink-0 rounded-full bg-primary/70 ${accent}`} />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate leading-snug text-[15px] text-foreground">
                {item.title}
              </span>
              <span className="text-xs text-muted-foreground">{item.meta}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage() {
  const [tasks, activity, documents, spaces] = await Promise.all([
    getTasks(),
    getActivity(),
    getDocuments(),
    getSpaces(),
  ]);

  const spaceName = new Map(spaces.map((s) => [s.id, s.name]));

  const todayTasks = tasks
    .filter((t) => t.status !== "done")
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      title: task.title,
      meta: [
        task.spaceId ? spaceName.get(task.spaceId) ?? "" : "",
        task.priority ? `· ${capitalize(task.priority)}` : "",
        task.dueDate ? `· Due ${formatShortDate(task.dueDate)}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      href: `/tasks/${task.id}`,
    }));

  const recentActivity = activity.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.text,
    meta: item.when,
    href: `/tasks/${item.taskId}`,
  }));

  const recentDocs = documents.slice(0, 5).map((doc) => ({
    id: doc.id,
    title: doc.title,
    meta: doc.spaceId ? spaceName.get(doc.spaceId) ?? "" : "",
    href: `/docs/${doc.id}`,
  }));

  const recentNotes = documents
    .filter((d) => d.kind === "note")
    .slice(0, 5)
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      meta: doc.spaceId ? spaceName.get(doc.spaceId) ?? "" : "",
      href: `/docs/${doc.id}`,
    }));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <header>
        <p className="text-xs font-semibold text-primary">{formatGreeting()}</p>
        <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          {dateString}
        </h1>
      </header>

      <section className="mt-8">
        <HourStrip />
      </section>

      <section className="mt-10">
        <SectionHeading>Today</SectionHeading>
        <ListCard items={todayTasks} />
      </section>

      <section className="mt-10">
        <SectionHeading>Recent activity</SectionHeading>
        <ListCard items={recentActivity} />
      </section>

      <section className="mt-10">
        <SectionHeading>Recent documents</SectionHeading>
        <ListCard items={recentDocs} />
      </section>

      <section className="mt-10">
        <SectionHeading>Recent notes</SectionHeading>
        <ListCard items={recentNotes} />
      </section>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatShortDate(date?: string) {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}