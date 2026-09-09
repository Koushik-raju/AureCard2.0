"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        name={name}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextareaField({
  label,
  name,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </Field>
  );
}

/**
 * A button that opens a small popover panel with a creation form.
 */
export function CreateButton({
  label,
  variant = "outline",
  size = "sm",
  description,
  children,
}: {
  label: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "xs" | "lg";
  description?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <span className="relative inline-flex">
      <Button variant={variant} size={size} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus className="size-4" />
        {open ? "Cancel" : label}
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
          <div className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-4 shadow-lg">
            {description ? (
              <p className="mb-3 max-w-prose text-sm text-muted-foreground">{description}</p>
            ) : null}
            {children(close)}
          </div>
        </>
      ) : null}
    </span>
  );
}

export function FormActions({
  onCancel,
  isPending,
  submitLabel,
}: {
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
        <X className="size-3.5" />
        Cancel
      </Button>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Creating…" : submitLabel}
      </Button>
    </div>
  );
}

export function useCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ id?: string; error?: string }>,
    onSuccess?: (id?: string) => void
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.error && result.id) {
        onSuccess?.(result.id);
      }
      router.refresh();
    });
  }

  return { isPending, run, router };
}