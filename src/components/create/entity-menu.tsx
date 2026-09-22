"use client";

import { useState, useTransition, useId, createContext, useContext } from "react";
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
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const close = () => setOpen(false);
  return (
    <DropdownContext.Provider value={{ close }}>
      <span className="relative inline-flex">
        <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
        {open ? (
          <>
            <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
            <div
              role="menu"
              id={id}
              className={cn(
                "absolute top-full z-50 mt-1 min-w-40 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg",
                align === "right" ? "right-0" : "left-0"
              )}
            >
              {children}
            </div>
          </>
        ) : null}
      </span>
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
}: {
  onDelete: () => Promise<{ error?: string }>;
  onDeleteRedirect?: string;
  onEdit: () => void;
  deleteLabel?: string;
  hasEdit?: boolean;
}) {
  return (
    <Dropdown
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