"use client";

import { useEffect, useRef, useState } from "react";
import { useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentBlock, DocumentBlockType } from "@/lib/types";
import { setTaskStatus, useTaskStatusOverrides } from "@/lib/session-store";
import {
  deleteBlock as deleteBlockAction,
  insertBlock as insertBlockAction,
  updateBlock as updateBlockAction,
} from "@/lib/mutations";

type EditableBlock = DocumentBlock;

const BLOCK_TYPE_LABEL: Record<DocumentBlockType, string> = {
  heading: "Heading",
  subheading: "Subheading",
  paragraph: "Text",
  bulleted: "Bulleted list",
  numbered: "Numbered list",
  checklist: "Checklist",
  task: "Task",
  quote: "Quote",
  divider: "Divider",
  callout: "Callout",
  code: "Code",
};

const INSERTABLE_TYPES: DocumentBlockType[] = [
  "paragraph",
  "heading",
  "subheading",
  "bulleted",
  "numbered",
  "checklist",
  "task",
  "quote",
  "callout",
  "code",
  "divider",
];

function nextTypeOnEnter(type: DocumentBlockType): DocumentBlockType {
  switch (type) {
    case "bulleted":
      return "bulleted";
    case "numbered":
      return "numbered";
    case "checklist":
      return "checklist";
    case "task":
      return "checklist";
    case "quote":
      return "quote";
    case "heading":
    case "subheading":
    case "callout":
    case "code":
    default:
      return "paragraph";
  }
}

function newBlock(documentId: string, type: DocumentBlockType): EditableBlock {
  return {
    id: crypto.randomUUID(),
    documentId,
    type,
    text: "",
    checked: false,
  };
}

function placeholderFor(type: DocumentBlockType): string {
  switch (type) {
    case "heading":
      return "Heading";
    case "subheading":
      return "Subheading";
    case "bulleted":
      return "List item";
    case "numbered":
      return "List item";
    case "checklist":
      return "Checklist item";
    case "task":
      return "Task…";
    case "quote":
      return "Quote";
    case "callout":
      return "Write a callout…";
    case "code":
      return "Type code…";
    default:
      return "Type '/' for commands, or just write…";
  }
}

function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

function BlockTextArea({
  block,
  focused,
  onFocus,
  onChange,
  onKeyDown,
  onBlur,
  className,
}: {
  block: EditableBlock;
  focused: boolean;
  onFocus: () => void;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  className?: string;
}) {
  const ref = useAutoResize(block.text);

  useEffect(() => {
    // Only move the caret when focus was requested programmatically
    // (Enter / insert). If the user clicked in, leave their caret alone.
    if (focused && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(block.text.length, block.text.length);
    }
  }, [focused, block.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onKeyDown(e);
    } else if (e.key === "Backspace" && block.text === "" && ref.current?.selectionStart === 0) {
      e.preventDefault();
      onKeyDown(e);
    }
  };

  return (
    <textarea
      ref={ref}
      value={block.text}
      rows={1}
      spellCheck
      placeholder={placeholderFor(block.type)}
      aria-label={BLOCK_TYPE_LABEL[block.type]}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onBlur}
      className={cn(
        "w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none",
        className
      )}
    />
  );
}

function ChecklistBox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        onToggle();
      }}
      className={cn(
        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10"
      )}
    >
      {checked ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}

type BlockEditorProps = {
  documentId: string;
  initialBlocks: EditableBlock[];
  taskTitles: Record<string, string>;
};

export function BlockEditor({ documentId, initialBlocks, taskTitles }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<EditableBlock[]>(() =>
    initialBlocks.map((b) => ({ ...b }))
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const taskOverrides = useTaskStatusOverrides();
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const updateText = (id: string, text: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)));
    const prevTimer = saveTimers.current.get(id);
    if (prevTimer) clearTimeout(prevTimer);
    const timer = setTimeout(() => {
      saveTimers.current.delete(id);
      startTransition(() => {
        updateBlockAction(documentId, id, { text }).catch(() => {});
      });
    }, 500);
    saveTimers.current.set(id, timer);
  };

  const setChecked = (id: string, checked: boolean) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        if (b.taskId) {
          setTaskStatus(b.taskId, checked ? "done" : "todo");
        }
        return { ...b, checked };
      })
    );
    startTransition(() => {
      updateBlockAction(documentId, id, { checked }).catch(() => {});
    });
  };

  const persistInsert = (
    block: EditableBlock,
    position: number
  ) => {
    startTransition(() => {
      insertBlockAction(documentId, {
        id: block.id,
        type: block.type,
        text: block.text,
        position,
      }).catch(() => {});
    });
  };

  const insertBlock = (afterId: string, type: DocumentBlockType) => {
    const block = newBlock(documentId, type);
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, block);
      return next;
    });
    setFocusedId(block.id);
    setMenuFor(null);
    persistInsert(block, blocks.findIndex((b) => b.id === afterId) + 1);
  };

  const deleteBlock = (id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const prevBlock = idx > 0 ? prev[idx - 1] : null;
      if (prevBlock) setFocusedId(prevBlock.id);
      return prev.filter((b) => b.id !== id);
    });
    setMenuFor(null);
    startTransition(() => {
      deleteBlockAction(documentId, id).catch(() => {});
    });
  };

  const handleEnter = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    const current = blocks[idx];
    if (!current) return;

    if (current.type === "code") {
      updateText(id, current.text + "\n");
      return;
    }

    const block = newBlock(documentId, nextTypeOnEnter(current.type));
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const next = [...prev];
      next.splice(i + 1, 0, block);
      return next;
    });
    setFocusedId(block.id);
    persistInsert(block, idx + 1);
  };

  const handleBackspace = (id: string) => {
    deleteBlock(id);
  };

  const numberedIndex = (block: EditableBlock) => {
    const start = blocks.findIndex((b) => b.id === block.id);
    let index = start;
    while (index > 0 && blocks[index - 1].type === "numbered") index -= 1;
    return start - index + 1;
  };

  const taskTitle = (block: EditableBlock) => {
    if (block.text) return block.text;
    return block.taskId ? taskTitles[block.taskId] ?? "Task" : "Task";
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="space-y-0.5" role="document" aria-label="Document editor">
        {blocks.map((block, index) => {
          const isLast = index === blocks.length - 1;
          const isChecked = block.taskId
            ? taskOverrides[block.taskId] === "done"
            : block.checked ?? false;
          return (
            <BlockRow
              key={block.id}
              block={block}
              index={index}
              isLast={isLast}
              focused={focusedId === block.id}
              showMenu={menuFor === block.id}
              numbered={block.type === "numbered" ? numberedIndex(block) : null}
              checked={isChecked}
              taskTitle={block.taskId ? taskTitle(block) : undefined}
              onChange={(text) => updateText(block.id, text)}
              onFocus={() => setFocusedId(block.id)}
              onToggle={() => setChecked(block.id, !isChecked)}
              onEnter={() => handleEnter(block.id)}
              onBackspace={() => handleBackspace(block.id)}
              onOpenMenu={() => setMenuFor(block.id)}
              onCloseMenu={() => setMenuFor(null)}
              onInsert={(type) => insertBlock(block.id, type)}
            />
          );
        })}
      </div>

      {blocks.length > 0 ? (
        <button
          type="button"
          onClick={() => insertBlock(blocks[blocks.length - 1].id, "paragraph")}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-4" />
          Add block
        </button>
      ) : null}
    </div>
  );
}

function BlockRow(props: {
  block: EditableBlock;
  index: number;
  isLast: boolean;
  focused: boolean;
  showMenu: boolean;
  numbered: number | null;
  checked: boolean;
  taskTitle?: string;
  onChange: (text: string) => void;
  onFocus: () => void;
  onToggle: () => void;
  onEnter: () => void;
  onBackspace: () => void;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onInsert: (type: DocumentBlockType) => void;
}) {
  const {
    block,
    index,
    isLast,
    focused,
    showMenu,
    numbered,
    checked,
    taskTitle,
    onChange,
    onFocus,
    onToggle,
    onEnter,
    onBackspace,
    onOpenMenu,
    onCloseMenu,
    onInsert,
  } = props;

  const editorProps = {
    block,
    focused,
    onFocus,
    onChange,
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter") onEnter();
      else if (e.key === "Backspace") onBackspace();
    },
  };

  const rowClass = "group relative flex items-start gap-2 rounded-md px-1 py-0.5";

  return (
    <div className={rowClass}>
      {block.type !== "divider" ? (
        <button
          type="button"
          aria-label="Add block"
          className={cn(
            "absolute -left-7 top-1.5 flex size-6 items-center justify-center rounded-md text-muted-foreground/70 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            showMenu || focused || index === 0 || isLast
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          )}
          onClick={onOpenMenu}
        >
          <Plus className="size-4" />
        </button>
      ) : null}

      {showMenu ? (
        <>
          <div className="fixed inset-0 z-10" onClick={onCloseMenu} aria-hidden="true" />
          <div className="absolute left-0 top-8 z-20 max-h-64 w-52 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
            {INSERTABLE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onInsert(type)}
                className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {BLOCK_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <BlockBody
        block={block}
        numbered={numbered}
        checked={checked}
        taskTitle={taskTitle}
        editorProps={editorProps}
        onToggle={onToggle}
      />
    </div>
  );
}

function BlockBody({
  block,
  numbered,
  checked,
  taskTitle,
  editorProps,
  onToggle,
}: {
  block: EditableBlock;
  numbered: number | null;
  checked: boolean;
  taskTitle?: string;
  editorProps: Parameters<typeof BlockTextArea>[0];
  onToggle: () => void;
}) {
  switch (block.type) {
    case "heading":
      return (
        <BlockTextArea
          {...editorProps}
          className="font-serif text-2xl font-medium tracking-tight sm:text-3xl"
        />
      );
    case "subheading":
      return <BlockTextArea {...editorProps} className="font-serif text-lg font-medium pt-1" />;
    case "bulleted":
      return (
        <div className="flex items-start gap-2.5">
          <span className="mt-3 select-none text-muted-foreground" aria-hidden="true">
            •
          </span>
          <BlockTextArea {...editorProps} />
        </div>
      );
    case "numbered":
      return (
        <div className="flex items-start gap-2.5">
          <span className="mt-3 select-none text-sm tabular-nums text-muted-foreground" aria-hidden="true">
            {numbered ?? 1}.
          </span>
          <BlockTextArea {...editorProps} />
        </div>
      );
    case "checklist":
      return (
        <div className="flex items-start gap-2.5">
          <ChecklistBox checked={checked} onToggle={onToggle} label={block.text || "Checklist item"} />
          <BlockTextArea
            {...editorProps}
            className={cn(checked && "text-muted-foreground line-through")}
          />
        </div>
      );
    case "task":
      return (
        <div className="flex items-start gap-2.5 py-0.5 text-[15px]">
          <ChecklistBox checked={checked} onToggle={onToggle} label={taskTitle ?? "Task"} />
          <div className="w-full">
            <BlockTextArea
              {...editorProps}
              className={cn(checked && "text-muted-foreground line-through")}
            />
            {block.taskId ? (
              <div>
                <a
                  href={`/tasks/${block.taskId}`}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Task · {taskTitle}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="w-full border-l-2 border-muted-foreground/30 pl-4">
          <BlockTextArea {...editorProps} className="italic text-muted-foreground" />
        </div>
      );
    case "divider":
      return (
        <div className="py-1">
          <hr className="border-border" />
        </div>
      );
    case "callout":
      return (
        <div className="w-full rounded-lg border border-border border-l-2 border-l-primary bg-muted/60 px-4 py-3">
          <BlockTextArea {...editorProps} />
        </div>
      );
    case "code":
      return (
        <div className="w-full overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2">
          <BlockTextArea {...editorProps} className="font-mono text-[13px]" />
        </div>
      );
    default:
      return <BlockTextArea {...editorProps} />;
  }
}