"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ExternalLink,
  ImageIcon,
  Link2,
  Trash2,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTaskItem, deleteTaskItem } from "@/lib/mutations";
import type { TaskAttachment, TaskAttachmentKind, TaskPriority } from "@/lib/types";

import { STORAGE_MAX_BYTES, uploadMediaFile } from "@/lib/storage";

/** @deprecated Use STORAGE_MAX_BYTES / DATA_URL_MAX_BYTES from "@/lib/storage". */
export const MAX_MEDIA_BYTES = STORAGE_MAX_BYTES;

const PRIORITY_OPTIONS: { value: TaskPriority | null; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: null, label: "None" },
];

export function PriorityPicker({
  value,
  onChange,
}: {
  value: TaskPriority | null;
  onChange: (v: TaskPriority | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -ml-1.5 text-[15px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {value ? capitalize(value) : "—"}
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <ul
            role="listbox"
            aria-label="Priority"
            className="absolute left-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <li key={option.label} role="option" aria-selected={value === option.value}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    value === option.value && "bg-muted"
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {value === option.value ? <Check className="size-4" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Read-only attachment preview used outside edit mode. */
export function AttachmentShow({ attachments }: { attachments: TaskAttachment[] }) {
  const links = attachments.filter((a) => a.kind === "link");
  const media = attachments.filter((a) => a.kind !== "link");
  return (
    <>
      {links.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {links.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {a.label || a.url}
              </a>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            </li>
          ))}
        </ul>
      ) : null}
      {media.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((a) => (
            <li key={a.id} className="relative overflow-hidden rounded-lg border border-border">
              {a.kind === "video" ? (
                <video src={a.url} controls className="aspect-video w-full bg-muted object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.url}
                  alt={a.label ?? ""}
                  className="aspect-video w-full bg-muted object-cover"
                />
              )}
              {a.label ? (
                <span className="absolute left-1.5 top-1.5 max-w-[85%] truncate rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] text-background">
                  {a.label}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** Staged add/remove attachment editor used inside edit mode. */
export function AttachmentsSection({
  attachments,
  added,
  removed,
  onAdd,
  onRemove,
}: {
  attachments: TaskAttachment[];
  added: TaskAttachment[];
  removed: Set<string>;
  onAdd: (a: { id: string; kind: TaskAttachmentKind; url: string; label?: string }) => void;
  onRemove: (id: string) => void;
}) {
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [addingLink, setAddingLink] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickFile(kind: "image" | "video", file?: File) {
    if (!file || uploading) return;
    if (file.size > STORAGE_MAX_BYTES) {
      setError(`"${file.name}" is too large. Keep files under 50MB.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const result = await uploadMediaFile(file, "tasks");
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onAdd({
        id: `new-${crypto.randomUUID()}`,
        kind,
        url: result.url,
        label: file.name,
      });
    } finally {
      setUploading(false);
    }
  }

  const shown = [...attachments.filter((a) => !removed.has(a.id)), ...added];

  return (
    <div>
      {shown.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {shown.map((a) => (
            <li
              key={a.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              {a.kind === "link" ? (
                <>
                  <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{a.label || a.url}</span>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open link"
                    className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </>
              ) : (
                <>
                  {a.kind === "video" ? (
                    <video
                      src={a.url}
                      controls
                      className="h-16 w-28 shrink-0 rounded-md bg-muted object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt=""
                      className="h-16 w-28 shrink-0 rounded-md bg-muted object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">{a.label || "Image"}</span>
                </>
              )}
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => onRemove(a.id)}
                className="rounded p-1 text-muted-foreground opacity-60 transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {uploading ? (
        <p className="mt-2 text-sm text-muted-foreground">Uploading media…</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAddingLink((v) => !v)}>
          <Link2 className="size-3.5" /> Add link
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => imageRef.current?.click()}>
          <ImageIcon className="size-3.5" /> Add image
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => videoRef.current?.click()}>
          <Video className="size-3.5" /> Add video
        </Button>
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickFile("image", e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            pickFile("video", e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {addingLink ? (
        <div className="mt-3 rounded-lg border border-border bg-card p-3">
          <Input
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Label (optional)"
            className="mb-2 h-8 text-sm"
          />
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="h-8 text-sm"
            autoFocus
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="xs" onClick={() => setAddingLink(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="xs"
              disabled={!linkUrl.trim()}
              onClick={() => {
                const url = linkUrl.trim();
                onAdd({
                  id: `new-${crypto.randomUUID()}`,
                  kind: "link",
                  url,
                  label: linkLabel.trim() || undefined,
                });
                setLinkLabel("");
                setLinkUrl("");
                setAddingLink(false);
              }}
            >
              Add
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AddSubtask({ taskId }: { taskId: string }) {
  const [value, setValue] = useState("");
  const { isPending, save } = useSave();
  function submit() {
    const title = value.trim();
    if (!title) return;
    save(async () => {
      await createTaskItem(taskId, title);
    }).then(() => setValue(""));
  }
  return (
    <form
      className="mt-3 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a subtask"
        className="h-8 text-sm"
        aria-label="New subtask"
      />
      <Button type="submit" size="sm" disabled={isPending || !value.trim()}>
        Add
      </Button>
    </form>
  );
}

export function DeleteSubtask({ taskId, itemId }: { taskId: string; itemId: string }) {
  const { isPending, save } = useSave();
  return (
    <button
      type="button"
      aria-label="Delete subtask"
      onClick={() => save(() => deleteTaskItem(taskId, itemId))}
      disabled={isPending}
      className="ml-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive disabled:opacity-40 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

export function LinkOut({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 truncate text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
    >
      <ExternalLink className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </a>
  );
}

function useSave() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const save = (mutate: () => Promise<unknown>) =>
    new Promise<void>((resolve) =>
      startTransition(async () => {
        await mutate();
        router.refresh();
        resolve();
      })
    );
  return { isPending, save };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}