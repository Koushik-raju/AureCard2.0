"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { File as FileIcon, FileText, Film, Image as ImageIcon, Lightbulb, ListMusic, Search, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentRef, NoteType, RecordingType, Space } from "@/lib/types";
import { NOTE_TYPE_OPTIONS, RECORDING_TYPES, formatDuration } from "@/lib/note-types";
import { LIBRARY_TYPE_LABEL, resolveDocType, type LibraryItemType } from "@/lib/doc-type";
import { createDocument } from "@/lib/mutations";
import { DocumentMenu } from "@/components/create/entity-menus";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type LibraryView = "recordings" | "notes" | "files";
type TypeFilter = "all" | RecordingType;

type DocsExplorerProps = {
  documents: DocumentRef[];
  spaces: Space[];
  /** Attachment metadata per document (no file bytes) for item typing. */
  mediaByDoc: Record<string, { mime: string; name: string; size: number }[]>;
};

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  ...RECORDING_TYPES.map((t) => ({
    key: t.key as TypeFilter,
    label: t.label.toUpperCase(),
  })),
];

const GROUP_ORDER = ["Today", "This Week", "Earlier"] as const;

function groupOf(createdAt: string | undefined): (typeof GROUP_ORDER)[number] {
  if (!createdAt) return "Earlier";
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return "Earlier";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (t >= startOfToday.getTime()) return "Today";
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  if (t >= startOfWeek.getTime()) return "This Week";
  return "Earlier";
}

function mimesOf(
  mediaByDoc: Record<string, { mime: string; name: string; size: number }[]>,
  id: string
): string[] {
  return (mediaByDoc[id] ?? []).map((m) => m.mime);
}

/** Decorative waveform bars, deterministic per recording. */
function Waveform({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const out: number[] = [];
    for (let i = 0; i < 22; i++) {
      h ^= h << 13;
      h >>>= 0;
      h ^= h >> 17;
      h = Math.imul(h, 0x5bd1e995);
      h ^= h >> 15;
      h >>>= 0;
      out.push(4 + (h % 12));
    }
    return out;
  }, [seed]);
  return (
    <span className="flex items-end gap-[2px]" aria-hidden="true">
      {bars.map((height, i) => (
        <span
          key={i}
          style={{ height }}
          className="w-[2px] shrink-0 rounded-full bg-muted-foreground/40"
        />
      ))}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h2>
  );
}

function RecordingCard({ doc }: { doc: DocumentRef }) {
  const duration = formatDuration(doc.durationSecs);
  return (
    <li>
      <Link
        href={`/docs/${doc.id}`}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Lightbulb className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-[17px] leading-snug">
            {doc.title}
          </span>
          {doc.summary ? (
            <span className="block truncate text-[13px] text-muted-foreground">
              {doc.summary}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Waveform seed={doc.id} />
          {duration ? (
            <span className="text-xs tabular-nums text-muted-foreground">{duration}</span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

function FileCard({
  doc,
  media,
}: {
  doc: DocumentRef;
  media: { mime: string; name: string; size: number }[];
}) {
  const type = resolveDocType(doc, media.map((m) => m.mime));
  const first = media[0];
  const Icon = type === "image" ? ImageIcon : media.some((m) => m.mime.startsWith("video/")) ? Film : FileIcon;
  return (
    <li>
      <Link
        href={`/docs/${doc.id}`}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-[17px] leading-snug">
            {doc.title}
          </span>
          <span className="block truncate text-[13px] text-muted-foreground">
            {LIBRARY_TYPE_LABEL[type]}
            {first?.name ? ` · ${first.name}` : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}

function NoteComposer({ spaces }: { spaces: Space[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("general");
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const body = text.trim();
    if (!body || !spaceId || isPending) return;
    setError(null);
    startTransition(async () => {
      const lines = body.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const title = (lines[0] ?? "Untitled note").slice(0, 80);
      const template = NOTE_TYPE_OPTIONS.find((o) => o.key === noteType);
      const blocks = [
        ...(lines.slice(1).map((line) => ({ type: "paragraph" as const, text: line.slice(0, 5000) }))),
        ...(template?.sections.map((s) => ({ type: "subheading" as const, text: s })) ?? []),
      ];
      const result = await createDocument({
        title,
        spaceId,
        kind: "note",
        noteType,
        blocks,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setText("");
      if (result.id) router.push(`/docs/${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <label htmlFor="note-composer" className="sr-only">
        Write a note
      </label>
      <textarea
        id="note-composer"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        rows={3}
          placeholder="Write the note — thoughts, a note to someone, anything. Atlas files and structures it."
        className="w-full resize-y bg-transparent font-serif text-[17px] leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Note type">
        {NOTE_TYPE_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={noteType === o.key}
            onClick={() => setNoteType(o.key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
              noteType === o.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          onClick={submit}
          disabled={!text.trim() || !spaceId || isPending}
          className="min-h-11 rounded-full px-6 text-xs font-semibold uppercase tracking-[0.08em]"
        >
          {isPending ? "Adding…" : "Add note"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setText("");
            setError(null);
          }}
          className="min-h-11 rounded px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          ⌘↵ adds
        </span>
        {spaces.length > 1 ? (
          <select
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            aria-label="Space"
            className="min-h-9 rounded-full border border-border bg-background px-3 text-xs text-muted-foreground"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function DocsExplorer({ documents, spaces, mediaByDoc }: DocsExplorerProps) {
  const [view, setView] = useState<LibraryView>("recordings");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");

  const typeOf = useCallback(
    (d: DocumentRef): LibraryItemType => resolveDocType(d, mimesOf(mediaByDoc, d.id)),
    [mediaByDoc]
  );

  const recordings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (typeOf(d) !== "recording") return false;
      if (typeFilter !== "all" && d.recordingType !== typeFilter) return false;
      if (
        q &&
        !d.title.toLowerCase().includes(q) &&
        !(d.summary ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [documents, typeFilter, query, typeOf]);

  const files = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      const t = typeOf(d);
      if (t !== "image" && t !== "file") return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, query, typeOf]);

  const notes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (d.kind === "file") return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, query]);

  const activeTypeLabel =
    typeFilter === "all"
      ? null
      : (RECORDING_TYPES.find((t) => t.key === typeFilter)?.label ?? typeFilter).toLowerCase();

  return (
    <div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          role="tablist"
          aria-label="Library view"
          className="grid flex-1 grid-cols-3 gap-1 rounded-full border border-border bg-card p-1"
        >
          {(
            [
              { key: "recordings", label: "Recordings" },
              { key: "notes", label: "Notes" },
              { key: "files", label: "Files" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={view === tab.key}
              onClick={() => setView(tab.key)}
              className={cn(
                "flex min-h-10 items-center justify-center gap-2 rounded-full text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                view === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListMusic className="size-4 sm:hidden" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search library…"
            aria-label="Search library"
            className="rounded-full pl-9"
          />
        </div>
      </div>

      {view === "notes" ? <NoteComposer spaces={spaces} /> : null}

      {view === "recordings" ? (
        <>
          <div
            role="tablist"
            aria-label="Recording type"
            className="mt-6 flex gap-1.5 overflow-x-auto pb-1"
          >
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={typeFilter === tab.key}
                onClick={() => setTypeFilter(tab.key)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                  typeFilter === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {GROUP_ORDER.map((group) => {
            const inGroup = recordings.filter((d) => groupOf(d.createdAt) === group);
            if (inGroup.length === 0) return null;
            return (
              <section key={group} aria-label={group} className="mt-8">
                <SectionLabel>{group}</SectionLabel>
                <ul className="mt-3 space-y-3">
                  {inGroup.map((doc) => (
                    <RecordingCard key={doc.id} doc={doc} />
                  ))}
                </ul>
              </section>
            );
          })}

          {recordings.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-serif text-2xl tracking-tight">
                {activeTypeLabel
                  ? `Nothing filed under ${activeTypeLabel}.`
                  : "Nothing in the library matches."}
              </p>
              {activeTypeLabel ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Atlas sorts notes by what they sound like. Try another filter.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : view === "files" ? (
        <>
          {GROUP_ORDER.map((group) => {
            const inGroup = files.filter((d) => groupOf(d.createdAt) === group);
            if (inGroup.length === 0) return null;
            return (
              <section key={group} aria-label={group} className="mt-8">
                <SectionLabel>{group}</SectionLabel>
                <ul className="mt-3 space-y-3">
                  {inGroup.map((doc) => (
                    <FileCard key={doc.id} doc={doc} media={mediaByDoc[doc.id] ?? []} />
                  ))}
                </ul>
              </section>
            );
          })}
          {files.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-serif text-2xl tracking-tight">No files yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Images, videos and PDFs land here — recordings stay under Recordings.
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {GROUP_ORDER.map((group) => {
            const inGroup = notes.filter((d) => groupOf(d.createdAt) === group);
            if (inGroup.length === 0) return null;
            return (
              <section key={group} aria-label={group} className="mt-8">
                <SectionLabel>{group}</SectionLabel>
                <ul className="mt-1 divide-y divide-border">
                  {inGroup.map((doc) => (
                    <li key={doc.id} className="group flex items-center gap-3">
                      <Link
                        href={`/docs/${doc.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-sm py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {doc.kind === "note" ? (
                          <StickyNote className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-serif text-[17px] leading-snug group-hover:underline">
                            {doc.title}
                          </span>
                          {doc.noteType ? (
                            <span className="mt-0.5 block text-xs uppercase tracking-[0.1em] text-muted-foreground">
                              {doc.noteType === "soap" ? "Clinical SOAP note" : doc.noteType === "meeting" ? "Meeting note" : "General"}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                      <DocumentMenu documentId={doc.id} documentTitle={doc.title} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {notes.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-serif text-2xl tracking-tight">No notes yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Write one above — Atlas files and structures it.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
