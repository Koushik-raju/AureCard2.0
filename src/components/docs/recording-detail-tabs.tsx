"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ListTodo, Plus } from "lucide-react";
import type {
  DocumentAttachment,
  DocumentBlock,
  DocumentRef,
  Task,
} from "@/lib/types";
import { ResponsiveTabs } from "@/components/layout/responsive-tabs";
import { BlockEditor } from "@/components/docs/block-editor";
import { FileDocumentView } from "@/components/docs/file-document-view";
import { LinkedTaskChip } from "@/components/docs/linked-task-chip";
import { Button } from "@/components/ui/button";

const TABS = [
  { value: "summary", label: "Summary" },
  { value: "transcript", label: "Transcript" },
  { value: "tasks", label: "Tasks" },
  { value: "mindmap", label: "Mind map" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard unavailable — no-op */
      }
    },
  };
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy(text);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={copy}
      disabled={!text}
      className="min-h-9 shrink-0"
      aria-label={label}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

type MindNode = { id: string; title: string; body: string[] };

function buildMindNodes(blocks: DocumentBlock[]): MindNode[] {
  const nodes: MindNode[] = [];
  let current: MindNode | null = null;
  for (const b of blocks) {
    if (b.type === "heading" || b.type === "subheading") {
      current = { id: b.id, title: b.text || "Untitled section", body: [] };
      nodes.push(current);
    } else if (b.type === "paragraph" || b.type === "bulleted" || b.type === "quote") {
      if (!current) {
        current = { id: `intro-${b.id}`, title: "Notes", body: [] };
        nodes.push(current);
      }
      if (b.text) current.body.push(b.text);
    }
  }
  return nodes;
}

type RecordingDetailTabsProps = {
  document: DocumentRef;
  blocks: DocumentBlock[];
  attachments: DocumentAttachment[];
  linkedTasks: Task[];
  taskTitles: Record<string, string>;
};

export function RecordingDetailTabs({
  document,
  blocks,
  attachments,
  linkedTasks,
  taskTitles,
}: RecordingDetailTabsProps) {
  const [tab, setTab] = useState<TabValue>("summary");
  const isFile = document.kind === "file";
  const audioFile = useMemo(
    () => attachments.find((a) => a.mime.startsWith("audio/")) ?? null,
    [attachments]
  );

  const summaryText = useMemo(
    () => blocks.map((b) => b.text).filter(Boolean).join("\n\n"),
    [blocks]
  );
  const transcriptLines = useMemo(
    () =>
      blocks.filter(
        (b) => b.text && (b.type === "paragraph" || b.type === "quote")
      ),
    [blocks]
  );
  const transcriptText = useMemo(
    () => transcriptLines.map((b) => b.text).join("\n"),
    [transcriptLines]
  );
  const mindNodes = useMemo(() => buildMindNodes(blocks), [blocks]);

  return (
    <div>
      {audioFile ? (
        <div className="sticky top-12 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-3">
          <audio src={audioFile.data} controls className="w-full" aria-label="Recording audio player" />
        </div>
      ) : null}

      <div className="mt-4">
        <ResponsiveTabs
          tabs={[...TABS]}
          value={tab}
          onChange={(v) => setTab(v as TabValue)}
          ariaLabel="Recording sections"
        />
      </div>

      <div className="mt-6">
        {tab === "summary" ? (
          <section aria-label="Summary">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl font-medium tracking-tight">
                Summary
              </h2>
              {!isFile ? <CopyButton text={summaryText} label="Copy summary" /> : null}
            </div>
            {isFile ? (
              <FileDocumentView attachments={attachments} />
            ) : (
              <BlockEditor
                documentId={document.id}
                initialBlocks={blocks}
                taskTitles={taskTitles}
              />
            )}
            <p className="mt-6 text-xs text-muted-foreground">
              Note type: {document.kind === "note" ? "Note" : isFile ? "File" : "Doc"} ·
              Commitments picked up at capture time appear under the Tasks tab.
            </p>
          </section>
        ) : null}

        {tab === "transcript" ? (
          <section aria-label="Transcript">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl font-medium tracking-tight">
                Transcript
              </h2>
              <CopyButton text={transcriptText} label="Copy transcript" />
            </div>
            {transcriptLines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
                No transcript yet. Speaker-labelled, timestamped lines appear
                here once recordings transcribe.
              </p>
            ) : (
              <>
                <ol className="space-y-3">
                  {transcriptLines.map((line, i) => (
                    <li
                      key={line.id}
                      className="rounded-xl border border-border bg-card p-4"
                    >
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Line {i + 1}
                      </p>
                      <p className="mt-1 text-[15px] leading-relaxed">{line.text}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs text-muted-foreground">
                  Live transcription captures raw text — speaker labels and
                  per-line timestamps aren&apos;t separated yet.
                </p>
              </>
            )}
          </section>
        ) : null}

        {tab === "tasks" ? (
          <section aria-label="Tasks">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl font-medium tracking-tight">
                Tasks from this recording
              </h2>
              <Button asChild variant="outline" size="sm" className="min-h-9">
                <Link href="/tasks">
                  <Plus className="size-4" />
                  Add manually
                </Link>
              </Button>
            </div>
            {linkedTasks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
                No commitments extracted from this recording yet. Only
                commitments land here — agenda points and things merely
                discussed are excluded.
              </p>
            ) : (
              <ul className="space-y-3">
                {linkedTasks.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ListTodo className="size-4 shrink-0 text-muted-foreground" />
                      <Link
                        href={`/tasks/${task.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                      >
                        {task.title}
                      </Link>
                      <LinkedTaskChip task={task} />
                    </div>
                    {task.quote ? (
                      <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
                        “{task.quote}”
                      </blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === "mindmap" ? (
          <section aria-label="Mind map">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl font-medium tracking-tight">
                Mind map
              </h2>
            </div>
            {mindNodes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
                Nothing to map yet. Headings in this note become connected
                cards here.
              </p>
            ) : (
              <>
                <div
                  className="overflow-auto rounded-xl border border-border bg-muted/30 p-4"
                  aria-label="Note mind map canvas"
                >
                  <div className="flex min-h-48 flex-col gap-3 sm:min-w-max sm:flex-row sm:items-stretch sm:gap-0">
                    {mindNodes.map((node, i) => (
                      <div key={node.id} className="flex flex-col sm:flex-row sm:items-stretch">
                        <article className="w-full rounded-xl border border-border bg-card p-4 shadow-sm sm:w-64 sm:shrink-0">
                          <h3 className="font-serif text-base font-medium tracking-tight">
                            {node.title}
                          </h3>
                          {node.body.slice(0, 3).map((line, j) => (
                            <p key={j} className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                              {line}
                            </p>
                          ))}
                        </article>
                        {i < mindNodes.length - 1 ? (
                          <div
                            aria-hidden="true"
                            className="flex items-center justify-center py-1 text-muted-foreground sm:px-3 sm:py-0"
                          >
                            <span className="rotate-90 text-lg sm:rotate-0">→</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Section outline from current blocks. Concept-level links and
                  amber cross-recording branches arrive with the global map.
                </p>
              </>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
