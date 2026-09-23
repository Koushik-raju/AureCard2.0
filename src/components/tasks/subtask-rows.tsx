"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskItem, TaskPriority } from "@/lib/types";
import {
  createTaskItem,
  updateTaskItem,
  type EditTaskItemInput,
} from "@/lib/mutations";
import { isEmptyBody, parseTaskBody } from "@/lib/task-body";
import { todayKey } from "@/lib/due";
import { PriorityDot, formatShortDate } from "./task-visuals";
import { CellInput, CellShell } from "./inline-cells";
import { TaskDocEditor } from "./task-doc-editor";
import { DeleteSubtask } from "./task-fields";

type ItemPatch = Omit<EditTaskItemInput, "id">;
type CellKind = "assignee" | "due" | "priority";

const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

function priorityLabel(p?: TaskPriority): string {
  if (!p) return "—";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function hasBody(item: TaskItem): boolean {
  if (!item.description?.trim()) return false;
  try {
    return !isEmptyBody(parseTaskBody(item.description));
  } catch {
    return true;
  }
}

/**
 * ClickUp-style subtask tree: inline-editable cells per row, expandable
 * Notion-style body per subtask, nested add and delete.
 */
export function SubtaskTree({
  taskId,
  items,
  doneMap,
  onToggle,
  onDelete,
}: {
  taskId: string;
  items: TaskItem[];
  doneMap: Record<string, boolean>;
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const roots = items.filter((i) => !i.parentId);
  if (roots.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1">
      <li
        aria-hidden="true"
        className="grid grid-cols-[20px_20px_minmax(0,1fr)_104px_92px_92px_28px_28px] items-center gap-1.5 rounded-lg px-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
      >
        <span />
        <span />
        <span>Subtask</span>
        <span>Assignee</span>
        <span>Due</span>
        <span>Priority</span>
        <span />
        <span />
      </li>
      {roots.map((item) => (
        <SubtaskRow
          key={item.id}
          taskId={taskId}
          item={item}
          items={items}
          doneMap={doneMap}
          depth={0}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function SubtaskRow({
  taskId,
  item,
  items,
  doneMap,
  depth,
  onToggle,
  onDelete,
}: {
  taskId: string;
  item: TaskItem;
  items: TaskItem[];
  doneMap: Record<string, boolean>;
  depth: number;
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const router = useRouter();
  const [patches, setPatches] = useState<ItemPatch>({});
  const [expanded, setExpanded] = useState(false);
  const [openCell, setOpenCell] = useState<CellKind | null>(null);
  const [draftCell, setDraftCell] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.title);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const done = doneMap[item.id] ?? item.done;
  const view: TaskItem = {
    ...item,
    title: patches.title ?? item.title,
    assignee: "assignee" in patches ? (patches.assignee ?? undefined) : item.assignee,
    dueDate: "dueDate" in patches ? (patches.dueDate ?? undefined) : item.dueDate,
    priority: "priority" in patches ? (patches.priority ?? undefined) : item.priority,
  };
  const children = items.filter((i) => i.parentId === item.id);

  function commit(patch: ItemPatch) {
    setError(null);
    setPatches((prev) => ({ ...prev, ...patch }));
    setOpenCell(null);
    setRenaming(false);
    startTransition(async () => {
      const result = await updateTaskItem(taskId, { id: item.id, ...patch });
      if (result.error) {
        setError(result.error);
        setPatches({});
        return;
      }
      router.refresh();
    });
  }

  function submitChild() {
    const title = childTitle.trim();
    if (!title) return;
    setChildTitle("");
    setAddingChild(false);
    startTransition(async () => {
      const result = await createTaskItem(taskId, title, item.id);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <li>
      <div
        className="group grid grid-cols-[20px_20px_minmax(0,1fr)_104px_92px_92px_28px_28px] items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50"
        style={{ marginLeft: depth * 18 }}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse subtask detail" : "Expand subtask detail"}
          title="Open detail (notes, blocks, media)"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          role="checkbox"
          aria-checked={done}
          aria-label={view.title}
          className={cn(
            "flex size-4 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10"
          )}
        >
          {done ? <Check className="size-3" strokeWidth={3} /> : null}
        </button>

        <span className="flex min-w-0 items-center gap-1">
          {renaming ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (renameValue.trim() && renameValue.trim() !== item.title) {
                  commit({ title: renameValue.trim() });
                } else {
                  setRenaming(false);
                }
              }}
            >
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setRenaming(false);
                    setRenameValue(item.title);
                  }
                }}
                autoFocus
                maxLength={200}
                aria-label="Subtask title"
                className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 text-sm outline-none focus-visible:border-ring"
              />
            </form>
          ) : (
            <>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm leading-snug",
                  done && "text-muted-foreground line-through"
                )}
                title={view.title}
              >
                {view.title}
              </span>
              {hasBody(item) ? (
                <span className="size-1.5 shrink-0 rounded-full bg-primary/60" title="Has notes" />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setRenameValue(view.title);
                  setRenaming(true);
                }}
                aria-label={`Rename ${view.title}`}
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Pencil className="size-3" />
              </button>
            </>
          )}
        </span>

        <CellShell
          open={openCell === "assignee"}
          onClose={() => setOpenCell(null)}
          display={
            <button
              type="button"
              onClick={() => {
                setOpenCell("assignee");
                setDraftCell(view.assignee ?? "");
              }}
              disabled={isPending}
              className="block max-w-full truncate rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
              title={view.assignee || "Set assignee"}
            >
              {view.assignee || <span className="text-muted-foreground/60">—</span>}
            </button>
          }
          editor={
            <CellInput
              value={draftCell}
              onChange={setDraftCell}
              placeholder="Assignee"
              onSave={() => commit({ assignee: draftCell.trim() || null })}
              onCancel={() => setOpenCell(null)}
            />
          }
        />

        <CellShell
          open={openCell === "due"}
          onClose={() => setOpenCell(null)}
          display={
            <button
              type="button"
              onClick={() => {
                setOpenCell("due");
                setDraftCell(view.dueDate ?? "");
              }}
              disabled={isPending}
              className={cn(
                "block rounded px-1 py-0.5 text-left text-xs tabular-nums hover:bg-muted",
                view.dueDate && !done && view.dueDate < todayKey() && "font-medium text-destructive"
              )}
            >
              {view.dueDate ? (
                formatShortDate(view.dueDate)
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
            </button>
          }
          editor={
            <CellInput
              type="date"
              value={draftCell}
              onChange={setDraftCell}
              onSave={() => commit({ dueDate: draftCell || null })}
              onCancel={() => setOpenCell(null)}
            />
          }
        />

        <CellShell
          open={openCell === "priority"}
          onClose={() => setOpenCell(null)}
          display={
            <button
              type="button"
              onClick={() => setOpenCell("priority")}
              disabled={isPending}
              className="flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
            >
              <PriorityDot priority={view.priority} />
              <span className="truncate">{priorityLabel(view.priority)}</span>
            </button>
          }
          editor={
            <div className="flex flex-col gap-0.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => commit({ priority: p })}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                >
                  <PriorityDot priority={p} />
                  {priorityLabel(p)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => commit({ priority: null })}
                className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
              >
                Clear
              </button>
            </div>
          }
        />

        <button
          type="button"
          onClick={() => {
            setAddingChild((v) => !v);
            setChildTitle("");
          }}
          aria-label={`Add nested subtask under ${view.title}`}
          title="Add nested subtask"
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
        {onDelete ? (
          <DeleteSubtask taskId={taskId} itemId={item.id} />
        ) : (
          <span />
        )}
      </div>

      {error ? (
        <p className="ml-10 text-xs text-destructive">{error}</p>
      ) : null}

      {addingChild ? (
        <form
          className="ml-10 flex items-center gap-1.5 py-1"
          style={{ marginLeft: 40 + depth * 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            submitChild();
          }}
        >
          <Plus className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={childTitle}
            onChange={(e) => setChildTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAddingChild(false);
                setChildTitle("");
              }
            }}
            placeholder="Add nested subtask… (Enter to save, Esc to cancel)"
            autoFocus
            maxLength={200}
            aria-label="Nested subtask title"
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
        </form>
      ) : null}

      {expanded ? (
        <div
          className="mb-1 rounded-lg border border-border bg-card p-3"
          style={{ marginLeft: 40 + depth * 18 }}
        >
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Notes
          </p>
          <TaskDocEditor
            key={`${item.id}:${item.description ?? ""}`}
            initialDescription={item.description}
            saveBody={(description) => updateTaskItem(taskId, { id: item.id, description })}
          />
        </div>
      ) : null}

      {children.length > 0 ? (
        <ul className="space-y-1">
          {children.map((child) => (
            <SubtaskRow
              key={child.id}
              taskId={taskId}
              item={child}
              items={items}
              doneMap={doneMap}
              depth={depth + 1}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
