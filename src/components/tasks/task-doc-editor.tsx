"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Film,
  GripVertical,
  ImageIcon,
  Link2,
  Music,
  Plus,
  Redo2,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STORAGE_MAX_BYTES, uploadMediaFile } from "@/lib/storage";
import {
  blockHasContent,
  emptyBody,
  isDividerShortcut,
  isEmptyBody,
  matchMarkdownShortcut,
  newBodyBlockId,
  parseTaskBody,
  serializeTaskBody,
  type BgColor,
  type TaskBodyBlock,
  type TaskBodyBlockType,
  type TextColor,
} from "@/lib/task-body";

/* ------------------------------------------------------------------ */
/* Menu catalog (mirrors Notion's grouping)                            */
/* ------------------------------------------------------------------ */

const MENU_GROUPS: { label: string; types: TaskBodyBlockType[] }[] = [
  {
    label: "Basic blocks",
    types: ["text", "h1", "h2", "h3", "h4", "bulleted", "numbered", "checklist", "toggle", "quote", "divider", "callout"],
  },
  {
    label: "Media",
    types: ["image", "video", "audio", "code", "file", "bookmark"],
  },
  {
    label: "Advanced",
    types: ["table", "toc"],
  },
];

const TYPE_LABEL: Record<TaskBodyBlockType, string> = {
  text: "Text",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  bulleted: "Bulleted list",
  numbered: "Numbered list",
  checklist: "To-do list",
  toggle: "Toggle list",
  quote: "Quote",
  divider: "Divider",
  callout: "Callout",
  code: "Code",
  image: "Image",
  video: "Video",
  audio: "Audio",
  file: "File",
  bookmark: "Web bookmark",
  table: "Table",
  toc: "Table of contents",
};

const TYPE_HINT: Record<TaskBodyBlockType, string> = {
  text: "Plain text",
  h1: "Large heading · #",
  h2: "Medium heading · ##",
  h3: "Small heading · ###",
  h4: "Tiny heading · ####",
  bulleted: "• List · -",
  numbered: "1. List",
  checklist: "To-do · []",
  toggle: "Collapsible section",
  quote: "Quotation · >",
  divider: "Separator · ---",
  callout: "Highlighted note",
  code: "Code snippet · ```",
  image: "Upload or embed",
  video: "Upload or embed",
  audio: "Upload or embed",
  file: "Upload a file",
  bookmark: "Link card",
  table: "Simple grid",
  toc: "Auto headings index",
};

const TURN_INTO_TYPES: TaskBodyBlockType[] = [
  "text", "h1", "h2", "h3", "h4", "bulleted", "numbered", "checklist", "toggle", "quote", "callout", "code",
];

const TEXT_COLORS: { key: TextColor | "default"; label: string; swatch: string }[] = [
  { key: "default", label: "Default", swatch: "bg-foreground" },
  { key: "gray", label: "Gray", swatch: "bg-stone-500" },
  { key: "red", label: "Red", swatch: "bg-red-500" },
  { key: "orange", label: "Orange", swatch: "bg-orange-500" },
  { key: "yellow", label: "Yellow", swatch: "bg-yellow-500" },
  { key: "green", label: "Green", swatch: "bg-green-600" },
  { key: "blue", label: "Blue", swatch: "bg-blue-500" },
  { key: "purple", label: "Purple", swatch: "bg-purple-500" },
];

const BG_COLORS: { key: BgColor | "none"; label: string; swatch: string }[] = [
  { key: "none", label: "None", swatch: "bg-transparent border border-border" },
  { key: "gray", label: "Gray", swatch: "bg-stone-500/25" },
  { key: "red", label: "Red", swatch: "bg-red-500/25" },
  { key: "orange", label: "Orange", swatch: "bg-orange-500/25" },
  { key: "yellow", label: "Yellow", swatch: "bg-yellow-500/25" },
  { key: "green", label: "Green", swatch: "bg-green-600/25" },
  { key: "blue", label: "Blue", swatch: "bg-blue-500/25" },
  { key: "purple", label: "Purple", swatch: "bg-purple-500/25" },
];

function textColorClass(color?: TextColor): string {
  switch (color) {
    case "gray":
      return "text-stone-500";
    case "red":
      return "text-red-500";
    case "orange":
      return "text-orange-500";
    case "yellow":
      return "text-yellow-500 dark:text-yellow-400";
    case "green":
      return "text-green-600 dark:text-green-400";
    case "blue":
      return "text-blue-500";
    case "purple":
      return "text-purple-500";
    default:
      return "";
  }
}

function bgClass(bg?: BgColor): string {
  switch (bg) {
    case "gray":
      return "bg-stone-500/15 rounded px-1";
    case "red":
      return "bg-red-500/15 rounded px-1";
    case "orange":
      return "bg-orange-500/15 rounded px-1";
    case "yellow":
      return "bg-yellow-500/20 rounded px-1";
    case "green":
      return "bg-green-600/15 rounded px-1";
    case "blue":
      return "bg-blue-500/15 rounded px-1";
    case "purple":
      return "bg-purple-500/15 rounded px-1";
    default:
      return "";
  }
}

function placeholderFor(type: TaskBodyBlockType): string {
  switch (type) {
    case "h1":
      return "Heading 1";
    case "h2":
      return "Heading 2";
    case "h3":
      return "Heading 3";
    case "h4":
      return "Heading 4";
    case "bulleted":
    case "numbered":
      return "List item";
    case "checklist":
      return "To-do";
    case "toggle":
      return "Toggle title";
    case "quote":
      return "Quote";
    case "callout":
      return "Write a callout…";
    case "code":
      return "Type code…";
    default:
      // Empty text lines stay blank — the + handle is the entry point.
      return "";
  }
}

function continueTypeOnEnter(type: TaskBodyBlockType): TaskBodyBlockType {
  switch (type) {
    case "bulleted":
      return "bulleted";
    case "numbered":
      return "numbered";
    case "checklist":
      return "checklist";
    case "toggle":
      return "text";
    default:
      return "text";
  }
}

function embedUrl(url: string): string | null {
  const trimmed = url.trim();
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

function slashQuery(text: string): string | null {
  const m = text.match(/^\/([a-z0-9 ]{0,24})$/i);
  return m ? m[1].toLowerCase() : null;
}

function matchesSlash(type: TaskBodyBlockType, q: string): boolean {
  if (!q) return true;
  return `${TYPE_LABEL[type]} ${TYPE_HINT[type]}`.toLowerCase().includes(q);
}

type FocusTarget = { id: string; caret: number | null };
type Heading = { id: string; level: number; text: string };

function collectHeadings(blocks: TaskBodyBlock[], out: Heading[] = []): Heading[] {
  for (const b of blocks) {
    if ((b.type === "h1" || b.type === "h2" || b.type === "h3" || b.type === "h4") && b.text.trim()) {
      out.push({ id: b.id, level: Number(b.type.slice(1)), text: b.text.trim() });
    }
    if (b.children?.length) collectHeadings(b.children, out);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Outer editor (owns data + autosave + media input)                   */
/* ------------------------------------------------------------------ */

type DragPayload = { scope: string; id: string } | null;

type SharedCtx = {
  areas: React.MutableRefObject<Map<string, HTMLTextAreaElement>>;
  focus: FocusTarget | null;
  setFocus: (f: FocusTarget | null) => void;
  requestMedia: (apply: (url: string, name?: string) => void, accept?: string) => void;
  headings: Heading[];
  focusBlock: (id: string) => void;
  drag: {
    get: () => DragPayload;
    set: (v: DragPayload) => void;
  };
};

export function TaskDocEditor({
  initialDescription,
  saveBody,
}: {
  initialDescription?: string;
  /** Persist the serialized body. Return `{ error }` on failure. */
  saveBody: (body: string) => Promise<{ error?: string }>;
}) {
  const [blocks, setBlocks] = useState<TaskBodyBlock[]>(() =>
    parseTaskBody(initialDescription)
  );
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const pendingMedia = useRef<{ apply: (url: string, name?: string) => void } | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaAccept, setMediaAccept] = useState("image/*,video/*,audio/*");
  const scope = useId();
  const dragRef = useRef<DragPayload>(null);
  const dragApi = useMemo(
    () => ({
      get: () => dragRef.current,
      set: (v: DragPayload) => {
        dragRef.current = v;
      },
    }),
    []
  );
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);
  const saveBodyRef = useRef(saveBody);
  useEffect(() => {
    saveBodyRef.current = saveBody;
  }, [saveBody]);

  /* ---- Undo / redo history (block-level snapshots) ---- */
  const pastRef = useRef<{ blocks: TaskBodyBlock[]; anchor: string | null }[]>([]);
  const futureRef = useRef<{ blocks: TaskBodyBlock[]; anchor: string | null }[]>([]);
  const lastPushRef = useRef(0);
  const focusRef = useRef<FocusTarget | null>(null);
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);
  // History lengths mirrored into state so the undo/redo buttons update.
  const [histLen, setHistLen] = useState({ past: 0, future: 0 });
  const canUndo = histLen.past > 0;
  const canRedo = histLen.future > 0;

  function syncHistLen() {
    setHistLen({ past: pastRef.current.length, future: futureRef.current.length });
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      const snapshot = blocksRef.current;
      startTransition(async () => {
        const result = await saveBodyRef.current(serializeTaskBody(snapshot));
        setSaveState(result.error ? "error" : "saved");
      });
    }, 900);
  }

  // Flush any pending save on unmount.
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void saveBodyRef.current(serializeTaskBody(blocksRef.current));
      }
    },
    []
  );

  function sigOf(list: TaskBodyBlock[]): string {
    const walk = (items: TaskBodyBlock[]): unknown[] =>
      items.map((b) => [
        b.id,
        b.type,
        !!b.checked,
        !!b.collapsed,
        b.width ?? null,
        b.tableData ? b.tableData.length : 0,
        b.text ? 1 : 0,
        b.children ? walk(b.children) : 0,
      ]);
    try {
      return JSON.stringify(walk(list));
    } catch {
      return String(list.length);
    }
  }

  function applyBlocks(next: TaskBodyBlock[]) {
    const prev = blocksRef.current;
    const now = Date.now();
    // Undo history: structural changes always snapshot; pure typing
    // coalesces into ~2s bursts so Ctrl+Z jumps over a burst, not a char.
    if (
      JSON.stringify(prev) !== JSON.stringify(next) &&
      (sigOf(prev) !== sigOf(next) || now - lastPushRef.current > 2000)
    ) {
      pastRef.current.push({ blocks: prev, anchor: focusRef.current?.id ?? null });
      if (pastRef.current.length > 50) pastRef.current.shift();
      futureRef.current = [];
      lastPushRef.current = now;
      syncHistLen();
    }
    setBlocks(next.length > 0 ? next : emptyBody());
    scheduleSave();
  }

  function restore(entry: { blocks: TaskBodyBlock[]; anchor: string | null }) {
    setBlocks(entry.blocks.length > 0 ? entry.blocks : emptyBody());
    scheduleSave();
    if (entry.anchor) setFocus({ id: entry.anchor, caret: null });
  }

  function undo() {
    const entry = pastRef.current.pop();
    if (!entry) return;
    futureRef.current.push({ blocks: blocksRef.current, anchor: focusRef.current?.id ?? null });
    restore(entry);
    syncHistLen();
  }

  function redo() {
    const entry = futureRef.current.pop();
    if (!entry) return;
    pastRef.current.push({ blocks: blocksRef.current, anchor: focusRef.current?.id ?? null });
    restore(entry);
    syncHistLen();
  }

  function onEditorKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    // Leave native undo alone inside table cells / URL inputs.
    if ((e.target as HTMLElement | null)?.tagName !== "TEXTAREA") return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((k === "z" && e.shiftKey) || k === "y") {
      e.preventDefault();
      redo();
    }
  }

  function appendTrailing() {
    const list = blocksRef.current;
    const last = list[list.length - 1];
    if (last && last.type === "text" && last.text === "" && areas.current.has(last.id)) {
      setFocus({ id: last.id, caret: 0 });
      return;
    }
    const block: TaskBodyBlock = { id: newBodyBlockId(), type: "text", text: "" };
    applyBlocks([...list, block]);
    setFocus({ id: block.id, caret: 0 });
  }

  function onEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement;
    if (
      t.closest(
        'button, input, a, textarea, select, [role="menu"], iframe, video, audio, table, [data-block-root]'
      )
    ) {
      return;
    }
    appendTrailing();
  }

  function requestMedia(apply: (url: string, name?: string) => void, accept?: string) {
    pendingMedia.current = { apply };
    setMediaAccept(accept ?? "image/*,video/*,audio/*");
    // Let the accept attribute update before opening the picker.
    requestAnimationFrame(() => mediaInput.current?.click());
  }

  function handleMediaPick(file?: File) {
    const pending = pendingMedia.current;
    pendingMedia.current = null;
    if (!file || !pending) return;
    if (file.size > STORAGE_MAX_BYTES) {
      setMediaError(`"${file.name}" is too large. Keep media under 50MB.`);
      return;
    }
    setMediaError(null);
    setMediaBusy(true);
    uploadMediaFile(file, "task-body")
      .then((result) => {
        if ("error" in result) setMediaError(result.error);
        else pending.apply(result.url, file.name);
      })
      .finally(() => setMediaBusy(false));
  }

  const headings = collectHeadings(blocks);

  function focusBlock(id: string) {
    // Expand every toggle so the target is visible, then focus it.
    const expand = (list: TaskBodyBlock[]): TaskBodyBlock[] =>
      list.map((b) =>
        b.type === "toggle"
          ? { ...b, collapsed: false, children: b.children ? expand(b.children) : b.children }
          : b.children
            ? { ...b, children: expand(b.children) }
            : b
      );
    setBlocks((prev) => expand(prev));
    scheduleSave();
    setFocus({ id, caret: 0 });
  }

  const shared: SharedCtx = {
    areas,
    focus,
    setFocus,
    requestMedia,
    headings,
    focusBlock,
    drag: dragApi,
  };

  return (
    <div onKeyDown={onEditorKeyDown} onClick={onEditorClick}>
      <div className="mb-1 flex h-5 items-center justify-between" aria-live="polite">
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <Redo2 className="size-3.5" />
          </button>
        </span>
        <span className="flex items-center gap-2">
          {saveState === "saving" && <span className="text-[11px] text-muted-foreground">Saving…</span>}
          {saveState === "saved" && !isEmptyBody(blocks) && (
            <span className="text-[11px] text-muted-foreground">Saved</span>
          )}
          {saveState === "error" && (
            <span className="text-[11px] text-destructive">Couldn&apos;t save — retrying on next edit</span>
          )}
        </span>
      </div>
      <BlockList
        scope={scope}
        levelId="root"
        blocks={blocks}
        onBlocks={applyBlocks}
        level={0}
        shared={shared}
      />
      {/* Click-anywhere zone (Notion-style): clicking empty space adds a line. */}
      <div className="min-h-12 cursor-text" aria-hidden="true" />
      <input
        ref={mediaInput}
        type="file"
        accept={mediaAccept}
        className="hidden"
        onChange={(e) => {
          handleMediaPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {mediaBusy && <p className="mt-2 text-sm text-muted-foreground">Uploading media…</p>}
      {mediaError && <p className="mt-2 text-sm text-destructive">{mediaError}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Block list (one level; nested instances power toggles)              */
/* ------------------------------------------------------------------ */

function BlockList({
  scope,
  levelId,
  blocks,
  onBlocks,
  level,
  shared,
}: {
  scope: string;
  levelId: string;
  blocks: TaskBodyBlock[];
  onBlocks: (next: TaskBodyBlock[]) => void;
  level: number;
  shared: SharedCtx;
}) {
  const [plusFor, setPlusFor] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);

  function updateBlock(id: string, patch: Partial<TaskBodyBlock>) {
    onBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function insertAfter(afterId: string | null, type: TaskBodyBlockType, text = ""): string {
    const block: TaskBodyBlock = { id: newBodyBlockId(), type, text };
    if (type === "image" || type === "video") block.width = 100;
    if (type === "table") {
      block.tableData = [
        ["", ""],
        ["", ""],
      ];
    }
    let next: TaskBodyBlock[];
    if (!afterId) {
      next = [...blocks, block];
    } else {
      const i = blocks.findIndex((b) => b.id === afterId);
      next = [...blocks];
      next.splice(i + 1, 0, block);
    }
    onBlocks(next);
    setPlusFor(null);
    if (!["image", "video", "audio", "file", "divider", "table", "toc"].includes(type)) {
      shared.setFocus({ id: block.id, caret: 0 });
    }
    return block.id;
  }

  function removeBlock(id: string) {
    const idx = blocks.findIndex((b) => b.id === id);
    const neighbor = blocks[idx - 1] ?? blocks[idx + 1];
    const next = blocks.filter((b) => b.id !== id);
    onBlocks(next.length > 0 ? next : emptyBody());
    setMenuFor(null);
    setPlusFor(null);
    if (neighbor) shared.setFocus({ id: neighbor.id, caret: neighbor.text.length });
  }

  function duplicateBlock(id: string) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const copy: TaskBodyBlock = {
      ...JSON.parse(JSON.stringify(blocks[idx])) as TaskBodyBlock,
      id: newBodyBlockId(),
    };
    const next = [...blocks];
    next.splice(idx + 1, 0, copy);
    onBlocks(next);
    setMenuFor(null);
    shared.setFocus({ id: copy.id, caret: 0 });
  }

  function moveBlock(id: string, delta: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id);
    const j = idx + delta;
    if (idx === -1 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[j]] = [next[j], next[idx]];
    onBlocks(next);
    setMenuFor(null);
  }

  function turnInto(id: string, type: TaskBodyBlockType) {
    const patch: Partial<TaskBodyBlock> = { type, text: "" };
    if (type === "image" || type === "video") patch.width = 100;
    if (type === "table" && !blocks.find((b) => b.id === id)?.tableData) {
      patch.tableData = [
        ["", ""],
        ["", ""],
      ];
    }
    updateBlock(id, patch);
    setMenuFor(null);
    setPlusFor(null);
    if (!["divider", "image", "video", "audio", "file", "table", "toc"].includes(type)) {
      shared.setFocus({ id, caret: 0 });
    }
  }

  function handleTextChange(id: string, newText: string) {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    // Markdown shortcuts ("# ", "- ", "[] " …) convert text blocks.
    if (block.type === "text") {
      const shortcut = matchMarkdownShortcut(newText);
      if (shortcut) {
        updateBlock(id, { type: shortcut.type, text: "" });
        shared.setFocus({ id, caret: 0 });
        return;
      }
    }
    updateBlock(id, { text: newText });
  }

  function splitBlock(id: string) {
    const el = shared.areas.current.get(id);
    const caret = el ? (el.selectionStart ?? el.value.length) : null;
    const current = blocks.find((b) => b.id === id);
    if (!current) return;
    // "---" + Enter becomes a divider, like Notion.
    if (isDividerShortcut(current.text)) {
      updateBlock(id, { type: "divider", text: "" });
      const newId = insertAfter(id, "text");
      shared.setFocus({ id: newId, caret: 0 });
      return;
    }
    if (current.type === "code") {
      const at = caret ?? current.text.length;
      updateBlock(id, { text: `${current.text.slice(0, at)}\n${current.text.slice(at)}` });
      return;
    }
    const at = caret ?? current.text.length;
    const left = current.text.slice(0, at);
    const right = current.text.slice(at);
    const nextType = right ? "text" : continueTypeOnEnter(current.type);
    updateBlock(id, { text: left });
    const newId = insertAfter(id, nextType, right);
    shared.setFocus({ id: newId, caret: 0 });
  }

  function mergeBack(id: string) {
    const el = shared.areas.current.get(id);
    const caret = el ? (el.selectionStart ?? 0) : 0;
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const current = blocks[idx];
    // Empty non-text block + Backspace reverts to text (Notion behavior).
    if (current.text === "" && current.type !== "text") {
      turnInto(id, "text");
      return;
    }
    if (idx <= 0) return;
    const prev = blocks[idx - 1];
    if (prev.type === "image" || prev.type === "video" || prev.type === "audio" || prev.type === "file" || prev.type === "divider") {
      removeBlock(prev.id);
      shared.setFocus({ id, caret });
      return;
    }
    if (current.text === "") {
      removeBlock(id);
      return;
    }
    if (caret === 0) {
      const junction = prev.text.length;
      const next = blocks.filter((b) => b.id !== id);
      const pi = next.findIndex((b) => b.id === prev.id);
      next[pi] = { ...next[pi], text: next[pi].text + current.text };
      onBlocks(next.length > 0 ? next : emptyBody());
      shared.setFocus({ id: prev.id, caret: junction });
    }
  }

  function numberedFor(id: string): number {
    const idx = blocks.findIndex((b) => b.id === id);
    let n = 1;
    for (let i = idx - 1; i >= 0 && blocks[i].type === "numbered"; i--) n += 1;
    return n;
  }

  /** Move focus to the nearest editable (textarea) block above/below. */
  function focusNeighbor(id: string, dir: -1 | 1) {
    const ids = blocks.filter((b) => shared.areas.current.has(b.id)).map((b) => b.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= ids.length) return;
    const target = ids[j];
    const caret = dir > 0 ? 0 : (blocks.find((b) => b.id === target)?.text.length ?? 0);
    shared.setFocus({ id: target, caret });
  }

  function dropReorder(targetId: string, after: boolean) {
    const drag = shared.drag.get();
    shared.drag.set(null);
    setDropTarget(null);
    if (!drag || drag.scope !== `${scope}:${levelId}` || drag.id === targetId) return;
    const from = blocks.findIndex((b) => b.id === drag.id);
    const to = blocks.findIndex((b) => b.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    let insertAt = next.findIndex((b) => b.id === targetId) + (after ? 1 : 0);
    insertAt = Math.max(0, Math.min(next.length, insertAt));
    next.splice(insertAt, 0, moved);
    onBlocks(next);
  }

  return (
    <div className="space-y-0.5" role="document" aria-label={level === 0 ? "Task body editor" : "Nested blocks"}>
      {blocks.map((block, index) => (
        <BodyRow
          key={block.id}
          block={block}
          index={index}
          isLast={index === blocks.length - 1}
          shared={shared}
          scope={scope}
          level={level}
          showPlus={plusFor === block.id}
          showMenu={menuFor === block.id}
          dropAfter={dropTarget?.id === block.id ? dropTarget.after : null}
          numbered={block.type === "numbered" ? numberedFor(block.id) : null}
          onOpenPlus={() => {
            setPlusFor(block.id);
            setMenuFor(null);
          }}
          onClosePlus={() => setPlusFor(null)}
          onOpenMenu={() => {
            setMenuFor(block.id);
            setPlusFor(null);
          }}
          onCloseMenu={() => setMenuFor(null)}
          onInsert={(type) => insertAfter(block.id, type)}
          onTurnInto={(type) => turnInto(block.id, type)}
          onDuplicate={() => duplicateBlock(block.id)}
          onMove={(delta) => moveBlock(block.id, delta)}
          onRemove={() => removeBlock(block.id)}
          onDragStart={() => {
            shared.drag.set({ scope: `${scope}:${levelId}`, id: block.id });
          }}
          onDragOver={(after) => setDropTarget({ id: block.id, after })}
          onDragLeave={() => setDropTarget((d) => (d?.id === block.id ? null : d))}
          onDrop={() => {
            if (dropTarget?.id === block.id) dropReorder(block.id, dropTarget.after);
          }}
          onTextChange={(text) => handleTextChange(block.id, text)}
          onToggleCheck={() => updateBlock(block.id, { checked: !block.checked })}
          onSplit={() => splitBlock(block.id)}
          onMergeBack={() => mergeBack(block.id)}
          onFocusUp={() => focusNeighbor(block.id, -1)}
          onFocusDown={() => focusNeighbor(block.id, 1)}
          onWidth={(width) => updateBlock(block.id, { width })}
          onLabel={(label) => updateBlock(block.id, { label })}
          onClearMedia={() => updateBlock(block.id, { text: "", label: undefined })}
          onSetMedia={(text) => updateBlock(block.id, { text })}
          onPickMedia={(accept) =>
            shared.requestMedia((url, name) =>
              updateBlock(block.id, { text: url, label: name ?? block.label })
            , accept)
          }
          onToggleCollapse={() => updateBlock(block.id, { collapsed: !block.collapsed })}
          onChildren={(kids) =>
            updateBlock(block.id, { children: kids.length > 0 ? kids : undefined })
          }
          onTable={(tableData) => updateBlock(block.id, { tableData })}
          onColor={(color, bg) => updateBlock(block.id, { color, bg })}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Row: gutter (plus + grip) + body + menus                            */
/* ------------------------------------------------------------------ */

function BodyRow(props: {
  block: TaskBodyBlock;
  index: number;
  isLast: boolean;
  shared: SharedCtx;
  scope: string;
  level: number;
  showPlus: boolean;
  showMenu: boolean;
  dropAfter: boolean | null;
  numbered: number | null;
  onOpenPlus: () => void;
  onClosePlus: () => void;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onInsert: (type: TaskBodyBlockType) => void;
  onTurnInto: (type: TaskBodyBlockType) => void;
  onDuplicate: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (after: boolean) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onTextChange: (text: string) => void;
  onToggleCheck: () => void;
  onSplit: () => void;
  onMergeBack: () => void;
  onFocusUp: () => void;
  onFocusDown: () => void;
  onWidth: (width: number) => void;
  onLabel: (label: string) => void;
  onClearMedia: () => void;
  onSetMedia: (text: string) => void;
  onPickMedia: (accept?: string) => void;
  onToggleCollapse: () => void;
  onChildren: (kids: TaskBodyBlock[]) => void;
  onTable: (tableData: string[][]) => void;
  onColor: (color: TextColor | undefined, bg: BgColor | undefined) => void;
}) {
  const { block, shared, showPlus, showMenu } = props;
  const focused = shared.focus?.id === block.id;
  const empty = !blockHasContent(block) && block.type !== "divider" && block.type !== "toc";
  // Slash-menu nav state, keyed by the current query so it resets as you type
  // (derived during render — no effect needed).
  const [slashNav, setSlashNav] = useState({ q: "", idx: 0, off: false });
  const slashQ = slashQuery(block.text);
  const navQ = slashQ ?? "";
  const nav = slashNav.q === navQ ? slashNav : { q: navQ, idx: 0, off: false };
  const slashIdx = nav.idx;
  const slashOff = nav.off;
  const setSlashIdx = (i: number) => setSlashNav({ q: navQ, idx: i, off: nav.off });
  const setSlashOff = (off: boolean) => setSlashNav({ q: navQ, idx: nav.idx, off });
  const slashItems =
    slashQ !== null &&
    (block.type === "text" || block.type === "h1" || block.type === "h2" || block.type === "h3" || block.type === "h4")
      ? MENU_GROUPS.flatMap((g) => g.types).filter((t) => matchesSlash(t, slashQ))
      : [];
  const showSlash = !slashOff && slashItems.length > 0;
  const query = slashQ;

  return (
    <div
      data-block-root={block.id}
      className="group relative flex items-start gap-1 rounded-md px-1 py-0.5"
      onDragOver={(e) => {
        if (!shared.drag.get()) return;
        e.preventDefault();
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        props.onDragOver(e.clientY > rect.top + rect.height / 2);
      }}
      onDragLeave={props.onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        props.onDrop();
      }}
    >
      {props.dropAfter !== null ? (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-x-1 h-0.5 rounded bg-primary",
            props.dropAfter ? "-bottom-px" : "-top-px"
          )}
        />
      ) : null}

      {/* Gutter: plus always discoverable, grip only when there is content */}
      <span className="absolute -left-12 top-1 flex shrink-0 items-center">
        <button
          type="button"
          aria-label="Add block"
          onClick={props.onOpenPlus}
          className={cn(
            "flex size-6 items-center justify-center rounded-md text-muted-foreground/70 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            showPlus || focused || empty ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <Plus className="size-4" />
        </button>
        {blockHasContent(block) ? (
          <button
            type="button"
            aria-label="Block actions (drag to move)"
            title="Drag to move · click for actions"
            draggable
            onDragStart={props.onDragStart}
            onDragEnd={() => {
              shared.drag.set(null);
            }}
            onClick={props.onOpenMenu}
            className="flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground/70 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing opacity-0 group-hover:opacity-100"
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
      </span>

      {showPlus ? (
        <>
          <div className="fixed inset-0 z-10" onClick={props.onClosePlus} aria-hidden="true" />
          <InsertMenu title="Insert block" filter="" onPick={(type) => props.onInsert(type)} />
        </>
      ) : null}

      {showMenu ? (
        <BlockMenu
          block={block}
          onClose={props.onCloseMenu}
          onTurnInto={props.onTurnInto}
          onColor={props.onColor}
          onDuplicate={props.onDuplicate}
          onMove={props.onMove}
          onRemove={props.onRemove}
        />
      ) : null}

      {showSlash ? (
        <SlashMenu
          query={query ?? ""}
          items={slashItems}
          active={slashIdx}
          onHover={setSlashIdx}
          onPick={(type) => props.onTurnInto(type)}
        />
      ) : null}

      <div className="min-w-0 flex-1">
        {block.type === "image" ? (
          <ImageBody block={props.block} onWidth={props.onWidth} onPickMedia={() => props.onPickMedia("image/*")} onRemove={props.onRemove} />
        ) : block.type === "video" ? (
          <VideoBody block={props.block} onSetMedia={props.onSetMedia} onPickMedia={() => props.onPickMedia("video/*")} onRemove={props.onRemove} />
        ) : block.type === "audio" ? (
          <AudioBody block={props.block} onSetMedia={props.onSetMedia} onPickMedia={() => props.onPickMedia("audio/*")} onRemove={props.onRemove} />
        ) : block.type === "file" ? (
          <FileBody block={props.block} onSetMedia={props.onSetMedia} onLabel={props.onLabel} onPickMedia={() => props.onPickMedia("*/*")} onRemove={props.onRemove} />
        ) : block.type === "bookmark" ? (
          <BookmarkBody block={props.block} onSetMedia={props.onSetMedia} onRemove={props.onRemove} onClear={props.onClearMedia} />
        ) : block.type === "divider" ? (
          <div className="group/div flex items-center gap-2 py-1.5">
            <hr className="flex-1 border-border" />
            <button
              type="button"
              onClick={props.onRemove}
              aria-label="Remove divider"
              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/div:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : block.type === "table" ? (
          <TableBody block={props.block} onTable={props.onTable} onRemove={props.onRemove} />
        ) : block.type === "toc" ? (
          <TocBody shared={props.shared} />
        ) : block.type === "toggle" ? (
          <ToggleBody
            block={props.block}
            shared={props.shared}
            scope={props.scope}
            level={props.level}
            onTextChange={props.onTextChange}
            onSplit={props.onSplit}
            onMergeBack={props.onMergeBack}
            onFocusUp={props.onFocusUp}
            onFocusDown={props.onFocusDown}
            onTurnInto={props.onTurnInto}
            onToggleCollapse={props.onToggleCollapse}
            onChildren={props.onChildren}
          />
        ) : (
          <TextBody
            block={props.block}
            focus={shared.focus?.id === props.block.id ? shared.focus : null}
            numbered={props.numbered}
            areas={shared.areas}
            slashItems={slashItems}
            slashActive={slashIdx}
            onSlashActive={setSlashIdx}
            onSlashPick={(type) => props.onTurnInto(type)}
            onSlashClose={() => setSlashOff(true)}
            onFocus={() => shared.setFocus({ id: props.block.id, caret: null })}
            onChange={props.onTextChange}
            onToggle={props.onToggleCheck}
            onSplit={props.onSplit}
            onMergeBack={props.onMergeBack}
            onFocusUp={props.onFocusUp}
            onFocusDown={props.onFocusDown}
            onTurnInto={props.onTurnInto}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menus                                                               */
/* ------------------------------------------------------------------ */

function InsertMenu({
  title,
  filter,
  onPick,
}: {
  title: string;
  filter: string;
  onPick: (type: TaskBodyBlockType) => void;
}) {
  const q = filter.toLowerCase();
  return (
    <div
      role="menu"
      aria-label={title}
      className="absolute left-0 top-8 z-20 max-h-72 w-60 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      {MENU_GROUPS.map((group) => {
        const types = group.types.filter((t) => matchesSlash(t, q));
        if (types.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {group.label}
            </p>
            {types.map((type) => (
              <button
                key={type}
                type="button"
                role="menuitem"
                onClick={() => onPick(type)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{TYPE_LABEL[type]}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{TYPE_HINT[type]}</span>
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SlashMenu({
  query,
  items,
  active,
  onHover,
  onPick,
}: {
  query: string;
  items: TaskBodyBlockType[];
  active: number;
  onHover: (i: number) => void;
  onPick: (type: TaskBodyBlockType) => void;
}) {
  const flat = items.filter((t) => matchesSlash(t, query));
  if (flat.length === 0) return null;
  return (
    <div
      role="menu"
      aria-label="Turn into block"
      className="absolute left-8 top-8 z-20 max-h-72 w-60 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      {flat.map((type, i) => (
        <button
          key={type}
          type="button"
          role="menuitem"
          aria-current={i === active ? true : undefined}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(type)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            i === active && "bg-muted"
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{TYPE_LABEL[type]}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{TYPE_HINT[type]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function BlockMenu({
  block,
  onClose,
  onTurnInto,
  onColor,
  onDuplicate,
  onMove,
  onRemove,
}: {
  block: TaskBodyBlock;
  onClose: () => void;
  onTurnInto: (type: TaskBodyBlockType) => void;
  onColor: (color: TextColor | undefined, bg: BgColor | undefined) => void;
  onDuplicate: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [submenu, setSubmenu] = useState<null | "turn" | "color">(null);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(block.text || TYPE_LABEL[block.type]);
    } catch {
      /* clipboard unavailable */
    }
    onClose();
  }

  const itemClass =
    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        aria-label="Block actions"
        className="absolute left-0 top-8 z-20 max-h-80 w-60 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
      >
        {submenu === null ? (
          <>
            <button type="button" role="menuitem" onClick={() => setSubmenu("turn")} className={itemClass}>
              Turn into <span className="text-muted-foreground">›</span>
            </button>
            <button type="button" role="menuitem" onClick={() => setSubmenu("color")} className={itemClass}>
              Color <span className="text-muted-foreground">›</span>
            </button>
            <button type="button" role="menuitem" onClick={copyText} className={itemClass}>
              Copy text
            </button>
            <button type="button" role="menuitem" onClick={onDuplicate} className={itemClass}>
              Duplicate
            </button>
            <button type="button" role="menuitem" onClick={() => onMove(-1)} className={itemClass}>
              Move up
            </button>
            <button type="button" role="menuitem" onClick={() => onMove(1)} className={itemClass}>
              Move down
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onRemove}
              className={cn(itemClass, "text-destructive hover:bg-destructive/10")}
            >
              Delete
            </button>
          </>
        ) : null}

        {submenu === "turn" ? (
          <>
            <button type="button" onClick={() => setSubmenu(null)} className={cn(itemClass, "text-muted-foreground")}>
              ‹ Back
            </button>
            {TURN_INTO_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="menuitem"
                onClick={() => onTurnInto(type)}
                className={cn(itemClass, block.type === type && "bg-muted font-medium")}
              >
                {TYPE_LABEL[type]}
              </button>
            ))}
          </>
        ) : null}

        {submenu === "color" ? (
          <>
            <button type="button" onClick={() => setSubmenu(null)} className={cn(itemClass, "text-muted-foreground")}>
              ‹ Back
            </button>
            <p className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Text
            </p>
            <div className="flex flex-wrap gap-1 px-2.5 pb-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  title={c.label}
                  aria-label={`Text color ${c.label}`}
                  aria-pressed={(block.color ?? "default") === c.key}
                  onClick={() =>
                    onColor(c.key === "default" ? undefined : (c.key as TextColor), block.bg)
                  }
                  className={cn(
                    "size-6 rounded-full ring-offset-2 ring-offset-popover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    c.swatch,
                    (block.color ?? "default") === c.key && "ring-2 ring-ring"
                  )}
                />
              ))}
            </div>
            <p className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Background
            </p>
            <div className="flex flex-wrap gap-1 px-2.5 pb-1">
              {BG_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  title={c.label}
                  aria-label={`Background ${c.label}`}
                  aria-pressed={(block.bg ?? "none") === c.key}
                  onClick={() =>
                    onColor(block.color, c.key === "none" ? undefined : (c.key as BgColor))
                  }
                  className={cn(
                    "size-6 rounded-full ring-offset-2 ring-offset-popover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    c.swatch,
                    (block.bg ?? "none") === c.key && "ring-2 ring-ring"
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Text body                                                           */
/* ------------------------------------------------------------------ */

function TextBody({
  block,
  focus,
  numbered,
  areas,
  slashItems,
  slashActive,
  onSlashActive,
  onSlashPick,
  onSlashClose,
  onFocus,
  onChange,
  onToggle,
  onSplit,
  onMergeBack,
  onFocusUp,
  onFocusDown,
  onTurnInto,
}: {
  block: TaskBodyBlock;
  focus: FocusTarget | null;
  numbered: number | null;
  areas: React.MutableRefObject<Map<string, HTMLTextAreaElement>>;
  slashItems: TaskBodyBlockType[];
  slashActive: number;
  onSlashActive: (i: number) => void;
  onSlashPick: (type: TaskBodyBlockType) => void;
  onSlashClose: () => void;
  onFocus: () => void;
  onChange: (text: string) => void;
  onToggle: () => void;
  onSplit: () => void;
  onMergeBack: () => void;
  onFocusUp: () => void;
  onFocusDown: () => void;
  onTurnInto: (type: TaskBodyBlockType) => void;
}) {
  const query = slashQuery(block.text);
  const slashOpen = query !== null && slashItems.length > 0;
  const setRef = (el: HTMLTextAreaElement | null) => {
    if (el) areas.current.set(block.id, el);
    else areas.current.delete(block.id);
  };

  useEffect(() => {
    const el = areas.current.get(block.id);
    if (focus && el && document.activeElement !== el) {
      el.focus();
      const pos = focus.caret ?? el.value.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* ignore */
      }
    }
  }, [focus, block.id, areas]);

  useEffect(() => {
    const el = areas.current.get(block.id);
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.text, block.id, block.type, areas]);

  const area = (
    <textarea
      ref={setRef}
      value={block.text}
      rows={1}
      spellCheck
      placeholder={placeholderFor(block.type)}
      aria-label={TYPE_LABEL[block.type]}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          if (slashOpen) {
            e.preventDefault();
            onSlashPick(slashItems[Math.min(slashActive, slashItems.length - 1)]);
            return;
          }
          if (query !== null) {
            const flat = MENU_GROUPS.flatMap((g) => g.types).filter((t) =>
              matchesSlash(t, query)
            );
            if (flat[0]) {
              e.preventDefault();
              onTurnInto(flat[0]);
              return;
            }
          }
          e.preventDefault();
          onSplit();
        } else if (e.key === "Tab" && query !== null) {
          const flat = MENU_GROUPS.flatMap((g) => g.types).filter((t) =>
            matchesSlash(t, query)
          );
          if (flat[0]) {
            e.preventDefault();
            onTurnInto(flat[0]);
          }
        } else if (e.key === "ArrowUp") {
          const el = e.target as HTMLTextAreaElement;
          if (slashOpen) {
            e.preventDefault();
            onSlashActive((slashActive - 1 + slashItems.length) % slashItems.length);
          } else if (!el.value.slice(0, el.selectionStart ?? 0).includes("\n")) {
            // Caret is on the first line: move to the previous block.
            e.preventDefault();
            onFocusUp();
          }
        } else if (e.key === "ArrowDown") {
          const el = e.target as HTMLTextAreaElement;
          if (slashOpen) {
            e.preventDefault();
            onSlashActive((slashActive + 1) % slashItems.length);
          } else {
            const pos = el.selectionStart ?? el.value.length;
            if (!el.value.slice(pos).includes("\n")) {
              // Caret is on the last line: move to the next block.
              e.preventDefault();
              onFocusDown();
            }
          }
        } else if (e.key === "Backspace") {
          const el = e.target as HTMLTextAreaElement;
          if (el.selectionStart === 0) {
            e.preventDefault();
            onMergeBack();
          }
        } else if (e.key === "Escape") {
          if (slashOpen) {
            e.preventDefault();
            onSlashClose();
          }
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className={cn(
        "w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none",
        textColorClass(block.color),
        block.bg && bgClass(block.bg),
        block.type === "h1" && "font-serif text-3xl font-medium tracking-tight",
        block.type === "h2" && "font-serif text-2xl font-medium tracking-tight",
        block.type === "h3" && "font-serif text-xl font-medium tracking-tight",
        block.type === "h4" && "font-serif text-lg font-medium tracking-tight",
        block.type === "quote" && "italic text-muted-foreground",
        block.type === "code" && "font-mono text-[13px]",
        block.checked && "text-muted-foreground line-through"
      )}
    />
  );

  if (block.type === "bulleted") {
    return (
      <div className="flex items-start gap-2.5">
        <span className="mt-[11px] select-none text-muted-foreground" aria-hidden="true">•</span>
        {area}
      </div>
    );
  }
  if (block.type === "numbered") {
    return (
      <div className="flex items-start gap-2.5">
        <span className="mt-[9px] select-none text-sm tabular-nums text-muted-foreground" aria-hidden="true">
          {numbered ?? 1}.
        </span>
        {area}
      </div>
    );
  }
  if (block.type === "checklist") {
    return (
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={!!block.checked}
          aria-label={block.text || "Checklist item"}
          onClick={(e) => {
            e.preventDefault();
            onToggle();
          }}
          className={cn(
            "mt-1 flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            block.checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10"
          )}
        >
          {block.checked ? <Check className="size-3" strokeWidth={3} /> : null}
        </button>
        {area}
      </div>
    );
  }
  if (block.type === "quote") {
    return <div className="border-l-2 border-muted-foreground/30 pl-4">{area}</div>;
  }
  if (block.type === "callout") {
    return (
      <div className="rounded-lg border border-border border-l-2 border-l-primary bg-muted/60 px-4 py-3">
        {area}
      </div>
    );
  }
  if (block.type === "code") {
    return (
      <div className="overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2">{area}</div>
    );
  }
  return area;
}

/* ------------------------------------------------------------------ */
/* Toggle (collapsible + nested blocks)                                */
/* ------------------------------------------------------------------ */

function ToggleBody({
  block,
  shared,
  scope,
  level,
  onTextChange,
  onSplit,
  onMergeBack,
  onFocusUp,
  onFocusDown,
  onTurnInto,
  onToggleCollapse,
  onChildren,
}: {
  block: TaskBodyBlock;
  shared: SharedCtx;
  scope: string;
  level: number;
  onTextChange: (text: string) => void;
  onSplit: () => void;
  onMergeBack: () => void;
  onFocusUp: () => void;
  onFocusDown: () => void;
  onTurnInto: (type: TaskBodyBlockType) => void;
  onToggleCollapse: () => void;
  onChildren: (kids: TaskBodyBlock[]) => void;
}) {
  const collapsed = block.collapsed ?? true;
  const kids = block.children ?? [];
  const toggleSlashQ = slashQuery(block.text);
  const toggleSlashItems =
    toggleSlashQ !== null
      ? MENU_GROUPS.flatMap((g) => g.types).filter((t) => matchesSlash(t, toggleSlashQ))
      : [];
  return (
    <div>
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand toggle" : "Collapse toggle"}
          className="mt-1.5 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <TextBody
            block={block}
            focus={shared.focus?.id === block.id ? shared.focus : null}
            numbered={null}
            areas={shared.areas}
            slashItems={toggleSlashItems}
            slashActive={0}
            onSlashActive={() => {}}
            onSlashPick={(type) => onTurnInto(type)}
            onSlashClose={() => {}}
            onFocus={() => shared.setFocus({ id: block.id, caret: null })}
            onChange={onTextChange}
            onToggle={() => {}}
            onSplit={onSplit}
            onMergeBack={onMergeBack}
            onFocusUp={onFocusUp}
            onFocusDown={onFocusDown}
            onTurnInto={onTurnInto}
          />
        </div>
      </div>
      {!collapsed ? (
        <div className="ml-5 mt-0.5 border-l border-border/70 pl-2">
          <BlockList
            scope={scope}
            levelId={`toggle:${block.id}`}
            blocks={kids.length > 0 ? kids : emptyBody()}
            onBlocks={onChildren}
            level={level + 1}
            shared={shared}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Media: image / video / audio / file / bookmark                      */
/* ------------------------------------------------------------------ */

function MediaActions({
  onPickMedia,
  onRemove,
  extra,
}: {
  onPickMedia: () => void;
  onRemove: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mt-1 flex items-center gap-3 text-xs">
      <button
        type="button"
        onClick={onPickMedia}
        className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        Replace
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        Remove
      </button>
      {extra}
    </div>
  );
}

function ImageBody({
  block,
  onWidth,
  onPickMedia,
  onRemove,
}: {
  block: TaskBodyBlock;
  onWidth: (width: number) => void;
  onPickMedia: () => void;
  onRemove: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const width = block.width ?? 100;

  if (!block.text.trim()) {
    return (
      <button
        type="button"
        onClick={onPickMedia}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
      >
        <ImageIcon className="size-4" /> Upload an image
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="relative" style={{ width: `${width}%` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.text}
        alt=""
        className="w-full rounded-lg border border-border bg-muted object-contain"
      />
      <button
        type="button"
        aria-label="Resize image"
        title={`Width ${width}% — drag to resize`}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          dragRef.current = { startX: e.clientX, startW: width };
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          const wrap = wrapRef.current?.parentElement;
          if (!drag || !wrap) return;
          const rect = wrap.getBoundingClientRect();
          if (rect.width <= 0) return;
          const next = Math.min(100, Math.max(25, Math.round(drag.startW + ((e.clientX - drag.startX) / rect.width) * 100)));
          onWidth(next);
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        className="absolute inset-y-0 -right-2 flex w-4 cursor-ew-resize touch-none items-center justify-center rounded-full opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <span className="h-10 w-1.5 rounded-full bg-primary/70" />
      </button>
      <MediaActions onPickMedia={onPickMedia} onRemove={onRemove} extra={<span className="text-muted-foreground/70">{width}%</span>} />
    </div>
  );
}

function VideoBody({
  block,
  onSetMedia,
  onPickMedia,
  onRemove,
}: {
  block: TaskBodyBlock;
  onSetMedia: (text: string) => void;
  onPickMedia: () => void;
  onRemove: () => void;
}) {
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState("");
  const src = block.text.trim();
  const embed = src ? embedUrl(src) : null;

  if (!src) {
    if (!urlMode) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPickMedia}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            <Film className="size-4" /> Upload a video
          </button>
          <button
            type="button"
            onClick={() => setUrlMode(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            <Link2 className="size-4" /> Paste a link
          </button>
        </div>
      );
    }
    return (
      <UrlForm
        value={url}
        onChange={setUrl}
        placeholder="https://youtube.com/… or direct .mp4 link"
        onSubmit={() => {
          if (url.trim()) {
            onSetMedia(url.trim());
            setUrlMode(false);
            setUrl("");
          }
        }}
        onCancel={() => {
          setUrlMode(false);
          setUrl("");
        }}
      />
    );
  }

  return (
    <div className="w-full">
      {embed ? (
        <iframe
          src={embed}
          title="Embedded video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full rounded-lg border border-border bg-muted"
        />
      ) : (
        <video src={src} controls className="max-h-[480px] w-full rounded-lg border border-border bg-muted" />
      )}
      <MediaActions onPickMedia={onPickMedia} onRemove={onRemove} />
    </div>
  );
}

function AudioBody({
  block,
  onSetMedia,
  onPickMedia,
  onRemove,
}: {
  block: TaskBodyBlock;
  onSetMedia: (text: string) => void;
  onPickMedia: () => void;
  onRemove: () => void;
}) {
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState("");
  const src = block.text.trim();

  if (!src) {
    if (!urlMode) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPickMedia}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            <Music className="size-4" /> Upload audio
          </button>
          <button
            type="button"
            onClick={() => setUrlMode(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            <Link2 className="size-4" /> Paste a link
          </button>
        </div>
      );
    }
    return (
      <UrlForm
        value={url}
        onChange={setUrl}
        placeholder="https://…/episode.mp3"
        onSubmit={() => {
          if (url.trim()) {
            onSetMedia(url.trim());
            setUrlMode(false);
            setUrl("");
          }
        }}
        onCancel={() => {
          setUrlMode(false);
          setUrl("");
        }}
      />
    );
  }

  return (
    <div className="w-full rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Music className="size-4" />
        </span>
        <audio src={src} controls preload="none" className="min-w-0 flex-1" aria-label="Audio block player" />
      </div>
      <MediaActions onPickMedia={onPickMedia} onRemove={onRemove} />
    </div>
  );
}

function FileBody({
  block,
  onSetMedia,
  onLabel,
  onPickMedia,
  onRemove,
}: {
  block: TaskBodyBlock;
  onSetMedia: (text: string) => void;
  onLabel: (label: string) => void;
  onPickMedia: () => void;
  onRemove: () => void;
}) {
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState("");
  const src = block.text.trim();

  if (!src) {
    if (!urlMode) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPickMedia}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            <FileText className="size-4" /> Upload a file
          </button>
          <button
            type="button"
            onClick={() => setUrlMode(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            <Link2 className="size-4" /> Paste a link
          </button>
        </div>
      );
    }
    return (
      <UrlForm
        value={url}
        onChange={setUrl}
        placeholder="https://…/document.pdf"
        onSubmit={() => {
          if (url.trim()) {
            onSetMedia(url.trim());
            onLabel(url.trim().split("/").pop()?.split("?")[0] ?? "File");
            setUrlMode(false);
            setUrl("");
          }
        }}
        onCancel={() => {
          setUrlMode(false);
          setUrl("");
        }}
      />
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <FileText className="size-4" />
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary hover:underline"
        >
          {block.label || hostOf(src)}
        </a>
      </div>
      <MediaActions onPickMedia={onPickMedia} onRemove={onRemove} />
    </div>
  );
}

function BookmarkBody({
  block,
  onSetMedia,
  onRemove,
  onClear,
}: {
  block: TaskBodyBlock;
  onSetMedia: (text: string) => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  const [url, setUrl] = useState(block.text);
  const src = block.text.trim();

  if (!src) {
    return (
      <UrlForm
        value={url}
        onChange={setUrl}
        placeholder="https://…"
        onSubmit={() => {
          if (url.trim()) onSetMedia(url.trim());
        }}
        onCancel={onClear}
        submitLabel="Save"
      />
    );
  }

  return (
    <div className="w-full">
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-ring"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted font-serif text-sm font-medium text-muted-foreground">
          {hostOf(src).slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{hostOf(src)}</span>
          <span className="block truncate text-xs text-muted-foreground">{src}</span>
        </span>
      </a>
      <div className="mt-1 flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => onSetMedia("")}
          className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function UrlForm({
  value,
  onChange,
  placeholder,
  onSubmit,
  onCancel,
  submitLabel = "Embed",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
}) {
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-muted"
      >
        Cancel
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Table + table of contents                                           */
/* ------------------------------------------------------------------ */

function TableBody({
  block,
  onTable,
  onRemove,
}: {
  block: TaskBodyBlock;
  onTable: (tableData: string[][]) => void;
  onRemove: () => void;
}) {
  const rows = block.tableData?.length ? block.tableData : [["", ""]];
  const cols = Math.max(...rows.map((r) => r.length), 1);
  const grid = rows.map((r) => [...r, ...Array(Math.max(0, cols - r.length)).fill("")]);

  function setCell(ri: number, ci: number, value: string) {
    onTable(grid.map((row, i) => (i === ri ? row.map((c, j) => (j === ci ? value : c)) : row)));
  }
  function addRow() {
    onTable([...grid, Array(cols).fill("")]);
  }
  function addCol() {
    onTable(grid.map((row) => [...row, ""]));
  }
  function delRow() {
    if (grid.length <= 1) return;
    onTable(grid.slice(0, -1));
  }
  function delCol() {
    if (cols <= 1) return;
    onTable(grid.map((row) => row.slice(0, -1)));
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-0">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={
                      ri === 0
                        ? "border-r border-border bg-muted/60 font-medium last:border-r-0"
                        : "border-r border-border last:border-r-0"
                    }
                  >
                    <input
                      value={cell}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      aria-label={`Row ${ri + 1}, column ${ci + 1}`}
                      className="h-9 w-full min-w-24 bg-transparent px-2.5 outline-none placeholder:text-muted-foreground/50 focus-visible:bg-muted/40"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
        <button type="button" onClick={addRow} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">+ Row</button>
        <button type="button" onClick={addCol} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">+ Column</button>
        <button type="button" onClick={delRow} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">− Row</button>
        <button type="button" onClick={delCol} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">− Column</button>
        <span className="flex-1" />
        <button type="button" onClick={onRemove} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">Remove table</button>
      </div>
    </div>
  );
}

function TocBody({ shared }: { shared: SharedCtx }) {
  if (shared.headings.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        No headings yet — add a Heading block and it appears here automatically.
      </p>
    );
  }
  return (
    <nav aria-label="Table of contents" className="rounded-lg border border-border bg-card px-3 py-2">
      <ul className="divide-y divide-border/60">
        {shared.headings.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => shared.focusBlock(h.id)}
              className="block w-full truncate rounded px-1 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              style={{ paddingLeft: `${4 + (h.level - 1) * 14}px` }}
            >
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
