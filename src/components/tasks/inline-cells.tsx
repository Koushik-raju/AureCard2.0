"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** ClickUp-style inline cell: click to open a popover editor, click away to close. */
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
  if (!open) return <span className="min-w-0">{display}</span>;
  return (
    <span className="relative min-w-0">
      {display}
      <span className="fixed inset-0 z-10" onClick={onClose} aria-hidden="true" />
      <span
        className={cn(
          "absolute left-0 top-full z-20 mt-1 rounded-lg border border-border bg-popover p-1.5 shadow-lg",
          wide ? "w-56" : "w-44"
        )}
      >
        {editor}
      </span>
    </span>
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
