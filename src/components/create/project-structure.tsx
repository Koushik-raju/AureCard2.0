"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, FolderPlus, ListPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createFolder,
  createList,
  deleteFolder,
  deleteList,
} from "@/lib/mutations";

function InlineNameInput({
  label,
  submitLabel,
  onSave,
  onCancel,
  autoFocus,
}: {
  label: string;
  submitLabel: string;
  onSave: (value: string) => Promise<{ id?: string; error?: string }>;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSave(value);
      if (result.error) setError(result.error);
      else onCancel();
    });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Label className="sr-only">{label}</Label>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={label}
        className="h-7 flex-1"
        autoFocus={autoFocus}
        required
      />
      <Button type="submit" size="xs" disabled={isPending || !value.trim()}>
        {isPending ? "…" : submitLabel}
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" onClick={onCancel}>
        <X className="size-3.5" />
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </form>
  );
}

export function CreateFolderButton({
  projectId,
  spaceId,
}: {
  projectId: string;
  spaceId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        size="xs"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="New folder"
      >
        <FolderPlus className="size-3.5" />
        New folder
      </Button>
    );
  }

  return (
    <InlineNameInput
      label="Folder name"
      submitLabel="Add"
      autoFocus
      onCancel={() => setOpen(false)}
      onSave={async (name) => {
        const result = await createFolder({ name, projectId, spaceId });
        router.refresh();
        return result;
      }}
    />
  );
}

export function AddListInline({
  projectId,
  spaceId,
  folderId,
}: {
  projectId: string;
  spaceId: string;
  folderId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        size="xs"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground"
      >
        <ListPlus className="size-3.5" />
        New list
      </Button>
    );
  }

  return (
    <InlineNameInput
      label="List name"
      submitLabel="Add"
      autoFocus
      onCancel={() => setOpen(false)}
      onSave={async (name) => {
        const result = await createList({ name, projectId, spaceId, folderId });
        router.refresh();
        return result;
      }}
    />
  );
}

export function DeleteFolderButton({
  folderId,
  hasLists,
}: {
  folderId: string;
  hasLists: boolean;
}) {
  const router = useRouter();
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label="Delete folder"
      title="Delete folder"
      className="text-muted-foreground hover:text-destructive"
      disabled={hasLists}
      onClick={() =>
        void deleteFolder(folderId).then((result) => {
          if (!result.error) router.refresh();
        })
      }
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

export function DeleteListButton({ listId }: { listId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label="Delete list"
      title="Delete list"
      className="text-muted-foreground hover:text-destructive"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteList(listId);
          if (!result.error) router.refresh();
        })
      }
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}