"use client";

import { useCallback, useEffect, useRef } from "react";
import { Check } from "lucide-react";

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
  const width = wide ? 224 : 176;

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

  return (
    <>
      <span ref={triggerRef} className="min-w-0">
        {display}
      </span>
      {open ? (
        <>
          <span className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
          <span
            ref={menuRef}
            className="fixed z-50 rounded-lg border border-border bg-popover p-1.5 shadow-lg"
            style={{ width, maxHeight: 320, overflowY: "auto", visibility: "hidden" }}
          >
            {editor}
          </span>
        </>
      ) : null}
    </>
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
