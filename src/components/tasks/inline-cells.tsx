"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, X } from "lucide-react";
import { parseAssignees } from "@/lib/assignees";
import { AssigneeAvatar } from "./hues";

/**
 * ClickUp-style inline cell: click to open a popover editor.
 * The popover is viewport-fixed (measured from the trigger) so it floats
 * above scroll containers instead of being clipped inside them.
 */
export function CellShell({
  open,
  onClose,
  display,
  editor,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  display: React.ReactNode;
  editor: React.ReactNode;
  wide?: boolean;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);
  const menuId = useId();
  const width = wide ? 224 : 176;

  // Announce when this opens so independent ⋯ Dropdowns close.
  // (Cell menus are already exclusive via the parent's single openCell state,
  // so this shell only broadcasts — it never listens.)
  useEffect(() => {
    if (open) {
      window.dispatchEvent(
        new CustomEvent("atlas:menu-opened", { detail: { id: menuId, cell: true } })
      );
    }
  }, [open, menuId]);

  const position = useCallback(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    const r = trigger.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    menu.style.left = `${left}px`;
    menu.style.width = `${width}px`;
    // Open upward when there is no room below.
    if (r.bottom + 320 > window.innerHeight && r.top > 340) {
      menu.style.top = "";
      menu.style.bottom = `${Math.max(8, window.innerHeight - r.top + 4)}px`;
    } else {
      menu.style.bottom = "";
      menu.style.top = `${r.bottom + 4}px`;
    }
    menu.style.visibility = "visible";
  }, [width]);

  useEffect(() => {
    if (!open) return;
    position();
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open, position]);

  // Re-anchor after every render while open: row expand/collapse, add-forms
  // and list updates shift the trigger without firing scroll/resize.
  useEffect(() => {
    if (open) position();
  });

  // Portaled while open: the overlay + menu live on document.body so no
  // ancestor (opacity, filter, transform, overflow) can trap them underneath
  // column content. SSR-safe via the mounted flag.
  const [mounted, setMounted] = useState(false);
  // Portals can't hydrate (no SSR HTML for body-level content), so mount-gating
  // needs the effect — this is the standard documented workaround.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <span ref={triggerRef} className="min-w-0">
        {display}
      </span>
      {open && mounted
        ? createPortal(
            <>
              <span className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
              <span
                ref={menuRef}
                className="fixed z-50 rounded-lg border border-border bg-popover p-1.5 shadow-xl"
                style={{ width, maxHeight: 320, overflowY: "auto", visibility: "hidden" }}
              >
                {editor}
              </span>
            </>,
            document.body
          )
        : null}
    </>
  );
}

/** Multi-assignee picker for the tasks list cell: pills + add input + suggestions. */
export function AssigneeEditor({
  initial,
  suggestions,
  onSave,
  onCancel,
}: {
  initial: string[];
  suggestions?: string[];
  onSave: (list: string[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => parseAssignees(initial));
  const [input, setInput] = useState("");
  // Reset when a different task's editor opens.
  const key = initial.join("\u0000");
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setSelected(parseAssignees(initial));
    setInput("");
  }

  const known = useMemo(() => {
    const seen = new Set(selected.map((s) => s.toLowerCase()));
    return (suggestions ?? []).filter((s) => {
      const t = s.trim();
      return t && !seen.has(t.toLowerCase());
    }).slice(0, 8);
  }, [suggestions, selected]);

  function addRaw(raw: string) {
    const parts = parseAssignees(raw);
    if (parts.length === 0) return;
    setSelected((prev) => parseAssignees([...prev, ...parts]));
    setInput("");
  }

  function remove(name: string) {
    setSelected((prev) => prev.filter((p) => p.toLowerCase() !== name.toLowerCase()));
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <span
              key={name.toLowerCase()}
              className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-1 pr-1 text-xs font-medium"
            >
              <AssigneeAvatar name={name} size="sm" />
              <span className="max-w-24 truncate">{name}</span>
              <button
                type="button"
                onClick={() => remove(name)}
                aria-label={`Remove ${name}`}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No assignees yet.</p>
      )}
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) addRaw(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => {
            const v = e.target.value;
            // Comma acts as a quick-add separator for multiple names.
            if (v.includes(",")) addRaw(v);
            else setInput(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if ((e.key === "Enter" || e.key === "Tab") && input.trim()) {
              e.preventDefault();
              addRaw(input);
            }
            if (e.key === "Backspace" && !input && selected.length > 0) {
              remove(selected[selected.length - 1]);
            }
          }}
          placeholder="Add name… (Enter to add)"
          autoFocus
          maxLength={80}
          aria-label="Add assignee"
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-[13px] outline-none focus-visible:border-ring"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Add assignee"
          className="rounded-md border border-input p-1.5 text-muted-foreground disabled:opacity-40 hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      </form>
      {known.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <p className="px-1 text-[11px] uppercase tracking-wider text-muted-foreground">Suggest</p>
          {known.map((name) => (
            <button
              key={name.toLowerCase()}
              type="button"
              onClick={() => addRaw(name)}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AssigneeAvatar name={name} size="sm" />
              <span className="truncate">{name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-1 border-t border-border/60 pt-1.5">
        <button
          type="button"
          onClick={() => onSave([])}
          className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
        >
          Clear
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(selected)}
            aria-label="Save assignees"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
          >
            <Check className="size-3.5" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small text/date input with save button for inline cells. */
export function CellInput({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
  type,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        autoFocus
        maxLength={120}
        aria-label={placeholder ?? "Edit value"}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-[13px] outline-none focus-visible:border-ring"
      />
      <button
        type="submit"
        aria-label="Save"
        className="rounded-md bg-primary p-1.5 text-primary-foreground"
      >
        <Check className="size-3.5" />
      </button>
    </form>
  );
}
