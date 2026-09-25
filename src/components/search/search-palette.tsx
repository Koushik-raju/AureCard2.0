"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  FileText,
  Folder,
  List,
  ListTodo,
  MessageSquare,
  Plus,
  Search,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { filterSearchEntries, type SearchEntry } from "@/lib/search-index";

const CREATE_ACTIONS = [
  { label: "New task", hint: "Tasks", href: "/tasks" },
  { label: "New note", hint: "Library", href: "/docs" },
  { label: "New recording", hint: "Record", href: "/record" },
  { label: "New space", hint: "Spaces", href: "/spaces" },
  { label: "New project", hint: "Projects", href: "/projects" },
] as const;

function CategoryIcon({ category }: { category: SearchEntry["category"] }) {
  const cls = "size-4 shrink-0 text-muted-foreground";
  switch (category) {
    case "task":
      return <ListTodo className={cls} />;
    case "note":
      return <StickyNote className={cls} />;
    case "document":
      return <FileText className={cls} />;
    case "project":
    case "folder":
      return <Folder className={cls} />;
    case "list":
      return <List className={cls} />;
    case "comment":
      return <MessageSquare className={cls} />;
    case "space":
      return <span className="size-2 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />;
  }
}

function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/** Visible header trigger that opens the palette (for pointer users). */
export function SearchTriggerButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("atlas:open-search"))}
      className="hidden h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex sm:max-w-xs"
    >
      <span className="truncate">Search…</span>
      <kbd className="ml-auto shrink-0 rounded border border-border bg-muted px-1 text-[10px]">
        ⌘K
      </kbd>
    </button>
  );
}

export function SearchPalette() {  const router = useRouter();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  // Active row, keyed by query so it resets as you type (derived, no effect).
  const [nav, setNav] = useState({ q: "", active: 0 });
  const q = query.trim();
  const active = nav.q === q ? nav.active : 0;
  const setActive = (update: number | ((prev: number) => number)) =>
    setNav({ q, active: typeof update === "function" ? update(active) : update });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        close();
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("atlas:open-search", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("atlas:open-search", onOpenEvent);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    let cancelled = false;
    fetch("/api/search")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.entries) setEntries(data.entries);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open ]);

  const hits = entries ? filterSearchEntries(entries, q).slice(0, 9) : [];
  const showActions = !q;
  // Flat navigation order: results first, then create actions (when visible).
  const total = hits.length + (showActions ? CREATE_ACTIONS.length : 0);

  function go(href: string) {
    close();
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (total === 0 ? 0 : (a + 1) % total));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (total === 0 ? 0 : (a - 1 + total) % total));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < hits.length) go(hits[active].href);
      else if (showActions) go(CREATE_ACTIONS[active - hits.length].href);
    }
  }

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Search and commands">
      <div className="fixed inset-0 bg-black/40" onClick={close} aria-hidden="true" />
      <div className="fixed inset-x-0 top-[12vh] z-[71] mx-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search or create…"
            aria-label="Search workspace or create"
            className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            esc
          </kbd>
        </div>
        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {hits.map((entry, i) => (
            <li key={`${entry.category}:${entry.id}`}>
              <button
                type="button"
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(entry.href)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === active && "bg-muted"
                )}
              >
                <CategoryIcon category={entry.category} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{entry.title}</span>
                  {entry.subtitle ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.subtitle}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  {entry.category}
                </span>
              </button>
            </li>
          ))}
          {showActions ? (
            <li aria-label="Create" className="mt-1 border-t border-border/60 pt-1">
              <p className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Create
              </p>
              {CREATE_ACTIONS.map((action, j) => {
                const i = hits.length + j;
                return (
                  <button
                    key={action.label}
                    type="button"
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(action.href)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      i === active && "bg-muted"
                    )}
                  >
                    <Plus className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{action.label}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      {action.hint}
                    </span>
                  </button>
                );
              })}
            </li>
          ) : null}
          {q && hits.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for “{q}”.
            </li>
          ) : null}
        </ul>
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="rounded border border-border px-1">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-border px-1">↵</kbd> open</span>
          <span className="ml-auto">⌘K anywhere</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
