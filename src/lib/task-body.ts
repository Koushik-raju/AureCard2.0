/**
 * Notion-style body blocks for a task. Stored as a JSON envelope inside the
 * task `description` field so no schema change is needed: legacy plain-text
 * descriptions transparently become a single text block.
 */

export type TaskBodyBlockType =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "bulleted"
  | "numbered"
  | "checklist"
  | "quote"
  | "divider"
  | "callout"
  | "code"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "bookmark"
  | "toggle"
  | "table"
  | "toc";

export type TextColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple";

export type BgColor = TextColor;

export type TaskBodyBlock = {
  id: string;
  type: TaskBodyBlockType;
  text: string;
  checked?: boolean;
  /** Media width as a percentage (25–100). Defaults to 100. */
  width?: number;
  /** Display label for file blocks. */
  label?: string;
  /** Text color key. Absent means default. */
  color?: TextColor;
  /** Background highlight key. Absent means none. */
  bg?: BgColor;
  /** Collapsible children (toggle blocks). */
  children?: TaskBodyBlock[];
  /** Toggle collapsed state. */
  collapsed?: boolean;
  /** Table grid (table blocks). */
  tableData?: string[][];
};

const VALID_TYPES: ReadonlySet<string> = new Set([
  "text",
  "h1",
  "h2",
  "h3",
  "h4",
  "bulleted",
  "numbered",
  "checklist",
  "quote",
  "divider",
  "callout",
  "code",
  "image",
  "video",
  "audio",
  "file",
  "bookmark",
  "toggle",
  "table",
  "toc",
]);

const VALID_COLORS: ReadonlySet<string> = new Set([
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
]);

export function newBodyBlockId(): string {
  return `blk-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyBody(): TaskBodyBlock[] {
  return [{ id: newBodyBlockId(), type: "text", text: "" }];
}

function sanitizeTable(raw: unknown): string[][] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rows = raw
    .filter((r) => Array.isArray(r))
    .map((r) =>
      (r as unknown[]).map((c) => (typeof c === "string" ? c.slice(0, 500) : "")).slice(0, 12)
    )
    .slice(0, 50);
  if (rows.length === 0) return undefined;
  const cols = Math.max(...rows.map((r) => r.length));
  if (cols === 0) return undefined;
  return rows.map((r) => [...r, ...Array(Math.max(0, cols - r.length)).fill("")]);
}

function sanitizeBlock(raw: unknown, depth = 0): TaskBodyBlock | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const type = typeof r.type === "string" && VALID_TYPES.has(r.type)
    ? (r.type as TaskBodyBlockType)
    : null;
  if (!type) return null;
  const text = typeof r.text === "string" ? r.text.slice(0, 8000) : "";
  const block: TaskBodyBlock = {
    id: typeof r.id === "string" && r.id ? r.id.slice(0, 64) : newBodyBlockId(),
    type,
    text,
  };
  if (typeof r.checked === "boolean") block.checked = r.checked;
  if (typeof r.width === "number" && Number.isFinite(r.width)) {
    block.width = Math.min(100, Math.max(25, Math.round(r.width)));
  }
  if (typeof r.label === "string" && r.label) block.label = r.label.slice(0, 200);
  if (typeof r.color === "string" && VALID_COLORS.has(r.color)) {
    block.color = r.color as TextColor;
  }
  if (typeof r.bg === "string" && VALID_COLORS.has(r.bg)) {
    block.bg = r.bg as BgColor;
  }
  if (typeof r.collapsed === "boolean") block.collapsed = r.collapsed;
  if (depth < 4 && Array.isArray(r.children)) {
    const kids = (r.children as unknown[])
      .map((c) => sanitizeBlock(c, depth + 1))
      .filter((b): b is TaskBodyBlock => b !== null)
      .slice(0, 100);
    if (kids.length > 0) block.children = kids;
  }
  if (type === "table") {
    const table = sanitizeTable(r.tableData);
    if (table) block.tableData = table;
  }
  return block;
}

/** Parse a stored task description into editable blocks. Never throws. */
export function parseTaskBody(raw: string | undefined | null): TaskBodyBlock[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return emptyBody();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { blocks?: unknown }).blocks)) {
      const blocks = ((parsed as { blocks: unknown[] }).blocks)
        .map((b) => sanitizeBlock(b))
        .filter((b): b is TaskBodyBlock => b !== null)
        .slice(0, 500);
      if (blocks.length > 0) return blocks;
    }
  } catch {
    /* not JSON — treat as legacy plain text below */
  }
  // Legacy plain-text description: one text block per paragraph.
  const lines = trimmed.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean).slice(0, 500);
  if (lines.length === 0) return emptyBody();
  return lines.map((text) => ({ id: newBodyBlockId(), type: "text" as const, text: text.slice(0, 8000) }));
}

export function isEmptyBody(blocks: TaskBodyBlock[]): boolean {
  return blocks.every((b) => {
    if (b.type === "divider" || b.type === "toc") return true;
    if (b.type === "table") {
      const flat = (b.tableData ?? []).flat().join("").trim();
      if (flat) return false;
      return (b.children ?? []).every((c) =>
        isEmptyBody([c])
      );
    }
    if (b.type === "image" || b.type === "video" || b.type === "audio" || b.type === "file" || b.type === "bookmark") {
      return !b.text.trim();
    }
    if (b.type === "toggle") {
      return !b.text.trim() && isEmptyBody(b.children ?? []);
    }
    return !b.text.trim() && !b.checked;
  });
}

function cleanBlock(b: TaskBodyBlock): TaskBodyBlock {
  const out: TaskBodyBlock = { id: b.id, type: b.type, text: b.text.slice(0, 8000) };
  if (b.type === "checklist" && b.checked) out.checked = true;
  if ((b.type === "image" || b.type === "video") && b.width) out.width = b.width;
  if (b.type === "file" && b.label) out.label = b.label;
  if (b.color) out.color = b.color;
  if (b.bg) out.bg = b.bg;
  if (b.type === "toggle") {
    if (b.collapsed) out.collapsed = true;
    if (b.children?.length) {
      out.children = b.children.map(cleanBlock).slice(0, 100);
    }
  }
  if (b.type === "table" && b.tableData?.length) {
    out.tableData = b.tableData.map((row) => row.map((c) => c.slice(0, 500)).slice(0, 12)).slice(0, 50);
  }
  return out;
}

/** Serialize blocks for the task description field ("" when empty). */
export function serializeTaskBody(blocks: TaskBodyBlock[]): string {
  if (isEmptyBody(blocks)) return "";
  return JSON.stringify({ v: 1, blocks: blocks.map(cleanBlock).slice(0, 500) });
}

/** Plain-text fallback for previews, search and exports. */
export function bodyToPlainText(blocks: TaskBodyBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "divider" || b.type === "toc") continue;
    if (b.type === "image" || b.type === "video" || b.type === "audio") continue;
    if (b.type === "file" || b.type === "bookmark") {
      if (b.label) out.push(b.label);
      else if (b.text.trim()) out.push(b.text.trim());
      continue;
    }
    if (b.type === "table") {
      const flat = (b.tableData ?? []).flat().map((c) => c.trim()).filter(Boolean);
      if (flat.length) out.push(flat.join(" | "));
      continue;
    }
    if (b.text.trim()) out.push(b.text.trim());
    if (b.type === "toggle" && b.children?.length) {
      const nested = bodyToPlainText(b.children);
      if (nested) out.push(nested);
    }
  }
  return out.join("\n");
}

/** True when the block visibly holds content (drives the ⠿⠿ handle). */
export function blockHasContent(b: TaskBodyBlock): boolean {
  if (b.type === "divider" || b.type === "toc") return true;
  if (b.type === "table") return (b.tableData ?? []).flat().join("").trim().length > 0;
  if (
    b.type === "image" ||
    b.type === "video" ||
    b.type === "audio" ||
    b.type === "file" ||
    b.type === "bookmark"
  ) {
    return b.text.trim().length > 0;
  }
  if (b.text.trim().length > 0) return true;
  if (b.type === "toggle") return (b.children ?? []).length > 0;
  return false;
}

export type MarkdownShortcut =
  | { type: TaskBodyBlockType }
  | null;

/**
 * Notion-style markdown shortcut: given the current line text, return the
 * block type to convert to (the marker itself is stripped by the caller).
 * Matches "# ", "## ", "### ", "#### ", "- "/"* ", "1. ", "[] ", "> ", "``` ".
 */
export function matchMarkdownShortcut(text: string): MarkdownShortcut {
  if (/^#{1,4} $/.test(text)) {
    const level = text.trim().length;
    return { type: (["h1", "h2", "h3", "h4"] as const)[level - 1] };
  }
  if (/^([-*]) $/.test(text)) return { type: "bulleted" };
  if (/^1\. $/.test(text)) return { type: "numbered" };
  if (/^\[\] $/.test(text) || /^\[ \] $/.test(text)) return { type: "checklist" };
  if (/^> $/.test(text)) return { type: "quote" };
  if (/^``` $/.test(text)) return { type: "code" };
  return null;
}

/** Exact "---" becomes a divider (applied on Enter, like Notion). */
export function isDividerShortcut(text: string): boolean {
  return text.trim() === "---";
}
