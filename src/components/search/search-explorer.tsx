"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CircleDot,
  Eye,
  FileText,
  Folder,
  List,
  MessageSquare,
  Play,
  Search,
  StickyNote,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types";
import type { SearchEntry } from "@/lib/search-index";
import { useTaskStatusOverrides } from "@/lib/session-store";

export type { SearchEntry };

const STATUS_ICON: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  todo: CircleDot,
  "in-progress": Play,
  "in-review": Eye,
  done: Check,
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "text-muted-foreground",
  "in-progress": "text-primary",
  "in-review": "text-amber-600",
  done: "text-foreground",
};

const SUGGESTIONS = ["assessment", "QA", "login", "release", "onboarding", "design"];

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-primary/15 text-inherit">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function RowIcon({ entry, status }: { entry: SearchEntry; status?: TaskStatus }) {
  switch (entry.category) {
    case "task": {
      const Icon = STATUS_ICON[status ?? "todo"];
      return <Icon className={cn("size-4 shrink-0", STATUS_COLOR[status ?? "todo"])} />;
    }
    case "document":
      return <FileText className="size-4 shrink-0 text-muted-foreground" />;
    case "note":
      return <StickyNote className="size-4 shrink-0 text-muted-foreground" />;
    case "project":
    case "folder":
      return <Folder className="size-4 shrink-0 text-muted-foreground" />;
    case "list":
      return <List className="size-4 shrink-0 text-muted-foreground" />;
    case "comment":
      return <MessageSquare className="size-4 shrink-0 text-muted-foreground" />;
    case "space":
      return (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
      );
  }
}

function ResultRow({ entry, query }: { entry: SearchEntry; query: string }) {
  const overrides = useTaskStatusOverrides();
  const status = entry.category === "task" ? overrides[entry.id] ?? "todo" : undefined;

  return (
    <li>
      <Link
        href={entry.href}
        className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RowIcon entry={entry} status={status} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] leading-snug text-foreground">
            <Highlight text={entry.title} query={query} />
          </div>
          {entry.subtitle ? (
            <div className="truncate text-[13px] text-muted-foreground">
              <Highlight text={entry.subtitle} query={query} />
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function ResultSection({
  title,
  count,
  entries,
  query,
}: {
  title: string;
  count: number;
  entries: SearchEntry[];
  query: string;
}) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title} · <span className="text-foreground/60">{count}</span>
      </h2>
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card/40">
        {entries.map((entry) => (
          <ResultRow key={entry.id} entry={entry} query={query} />
        ))}
      </ul>
    </section>
  );
}

export function SearchExplorer({
  entries,
  allCount,
}: {
  entries: SearchEntry[];
  allCount: number;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    if (!q) {
      return {
        tasks: [] as SearchEntry[],
        docs: [] as SearchEntry[],
        projects: [] as SearchEntry[],
        places: [] as SearchEntry[],
        comments: [] as SearchEntry[],
      };
    }
    const hits = entries.filter((e) => e.match.toLowerCase().includes(q));
    return {
      tasks: hits.filter((e) => e.category === "task"),
      docs: hits.filter((e) => e.category === "document" || e.category === "note"),
      projects: hits.filter((e) => e.category === "project"),
      places: hits.filter(
        (e) => e.category === "space" || e.category === "list" || e.category === "folder"
      ),
      comments: hits.filter((e) => e.category === "comment"),
    };
  }, [entries, q]);

  const totalHits =
    groups.tasks.length +
    groups.docs.length +
    groups.projects.length +
    groups.places.length +
    groups.comments.length;

  return (
    <div className="mt-8">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks, projects, documents, notes, comments…"
          aria-label="Search workspace"
          className="h-14 w-full rounded-xl border border-border bg-card pl-12 pr-12 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {!q ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
            <Search className="size-6" />
          </div>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            Search across {allCount} tasks, projects, documents, notes, and comments — results
            appear as you type.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : totalHits === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-[15px] text-muted-foreground">
            No results for <span className="font-medium text-foreground">“{query}”</span>.
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground/80">
            Try a different word or browse from the sidebar.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-5 text-sm text-muted-foreground">
            {totalHits} result{totalHits === 1 ? "" : "s"} for{" "}
            <span className="font-medium text-foreground">“{query}”</span>
          </p>
          <ResultSection title="Tasks" count={groups.tasks.length} entries={groups.tasks} query={query} />
          <ResultSection title="Documents & notes" count={groups.docs.length} entries={groups.docs} query={query} />
          <ResultSection title="Projects" count={groups.projects.length} entries={groups.projects} query={query} />
          <ResultSection title="Places" count={groups.places.length} entries={groups.places} query={query} />
          <ResultSection title="Comments" count={groups.comments.length} entries={groups.comments} query={query} />
        </>
      )}
    </div>
  );
}