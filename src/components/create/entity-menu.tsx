"use client";

import { useCallback, useEffect, useRef, useState, useTransition, useId, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DropdownContext = createContext<{ close: () => void }>({ close: () => {} });

export function Dropdown({
  trigger,
  children,
  align = "right",
  onOpenChange,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  const [mounted, setMounted] = useState(false);
  // Portals can't hydrate (no SSR HTML for body-level content), so mount-gating
  // needs the effect — this is the standard documented workaround.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // One menu at a time: announce when this opens, close when another does.
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent("atlas:menu-opened", { detail: { id } }));
    }
  }, [open, id]);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string } | undefined;
      if (detail && detail.id !== id) closeRef.current();
    };
    window.addEventListener("atlas:menu-opened", handler);
    return () => window.removeEventListener("atlas:menu-opened", handler);
  }, [id]);

  const position = useCallback(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    const r = trigger.getBoundingClientRect();
    if (r.bottom + 320 > window.innerHeight && r.top > 340) {
      menu.style.top = "";
      menu.style.bottom = `${Math.max(8, window.innerHeight - r.top + 4)}px`;
    } else {
      menu.style.bottom = "";
      menu.style.top = `${r.bottom + 4}px`;
    }
    if (align === "right") {
      menu.style.left = "";
      menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    } else {
      menu.style.right = "";
      menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 200))}px`;
    }
    menu.style.visibility = "visible";
  }, [align]);

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

  return (
    <DropdownContext.Provider value={{ close }}>
      <span ref={triggerRef} className="relative inline-flex">
        <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      </span>
      {open && mounted
        ? createPortal(
            <>
              <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
              <div
                ref={menuRef}
                role="menu"
                id={id}
                style={{ width: 192, maxHeight: 320, overflowY: "auto", visibility: "hidden" }}
                className="fixed z-50 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-xl"
              >
                {children}
              </div>
            </>,
            document.body
          )
        : null}
    </DropdownContext.Provider>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger = false,
  disabled = false,
  closeOnClick = true,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  closeOnClick?: boolean;
}) {
  const { close } = useContext(DropdownContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onClick?.();
        if (closeOnClick) close();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function EntityMenu({
  onDelete,
  onDeleteRedirect,
  onEdit,
  deleteLabel = "Delete",
  hasEdit = true,
  onOpenChange,
}: {
  onDelete: () => Promise<{ error?: string }>;
  onDeleteRedirect?: string;
  onEdit: () => void;
  deleteLabel?: string;
  hasEdit?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dropdown
      onOpenChange={onOpenChange}
      trigger={
        <Button variant="ghost" size="icon" aria-label="Actions">
          <MoreHorizontal className="size-4" />
        </Button>
      }
    >
      {hasEdit ? (
        <MenuItem icon={<Pencil className="size-4" />} onClick={onEdit}>
          Rename
        </MenuItem>
      ) : null}
      <DeleteMenuItem
        onDelete={onDelete}
        redirectHref={onDeleteRedirect}
        label={deleteLabel}
      />
    </Dropdown>
  );
}

export function DeleteMenuItem({
  onDelete,
  redirectHref,
  label,
}: {
  onDelete: () => Promise<{ error?: string }>;
  redirectHref?: string;
  label: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { close } = useContext(DropdownContext);

  if (!confirming) {
    return (
      <MenuItem
        icon={<Trash2 className="size-4" />}
        danger
        closeOnClick={false}
        onClick={() => setConfirming(true)}
      >
        {label}
      </MenuItem>
    );
  }

  return (
    <div className="rounded-md p-2">
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        Are you sure? This can&apos;t be undone.
      </p>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            setConfirming(false);
            close();
          }}
          disabled={isPending}
        >
          Keep
        </Button>
        <Button
          variant="destructive"
          size="xs"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await onDelete();
              if (result.error) {
                setError(result.error);
                return;
              }
              close();
              if (redirectHref) router.push(redirectHref);
              router.refresh();
            })
          }
        >
          {isPending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}

export function RenameForm({
  initial,
  onSave,
  onClose,
  submitLabel = "Save",
}: {
  initial: string;
  onSave: (value: string) => Promise<{ error?: string }>;
  onClose: () => void;
  submitLabel?: string;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSave(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-card p-4">
      <Label htmlFor="rename" className="text-xs text-muted-foreground">
        New name
      </Label>
      <Input
        id="rename"
        name="rename"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-1.5"
        autoFocus
        required
      />
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !value.trim()}>
          {isPending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}