"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSpace, updateProject, updateDocument } from "@/lib/mutations";

export function HeaderEditor({
  name,
  description,
  marker,
  onSave,
  actions,
  submitLabel = "Save",
}: {
  name: string;
  description?: string;
  marker?: React.ReactNode;
  onSave: (payload: { name: string; description?: string }) => Promise<{ error?: string }>;
  actions?: React.ReactNode;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit() {
    setDraftName(name);
    setDraftDescription(description ?? "");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await onSave({
        name: draftName,
        ...(description !== undefined ? { description: draftDescription } : {}),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      setEditing(false);
    });
  }

  return (
    <div className="min-w-0 flex-1">
      {editing ? (
        <div className="max-w-2xl space-y-3">
          <div>
            <Label htmlFor="header-name" className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input
              id="header-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="mt-1.5"
              autoFocus
            />
          </div>
          {description !== undefined ? (
            <div>
              <Label htmlFor="header-description" className="text-xs text-muted-foreground">
                Description
              </Label>
              <textarea
                id="header-description"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                rows={3}
                placeholder="No description"
                className="mt-1.5 w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {marker}
            <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
              {name}
            </h1>
          </div>
          {description ? (
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {actions}
        {editing ? (
          <>
            <Button variant="ghost" size="sm" onClick={cancel} disabled={isPending}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={isPending || !draftName.trim()}>
              <Check className="size-4" />
              {isPending ? "Saving…" : submitLabel}
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={startEdit} aria-label="Edit details">
            <Pencil className="size-4" />
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Server-safe wrappers: take only serializable props (ids + strings) and
 * call server actions internally, so Server Components never pass closures
 * to this Client Component (banned in Next.js 16).
 */
export function SpaceHeaderEditor({
  spaceId,
  name,
  description,
  marker,
  actions,
}: {
  spaceId: string;
  name: string;
  description?: string;
  marker?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <HeaderEditor
      name={name}
      description={description}
      marker={marker}
      actions={actions}
      onSave={(payload) => updateSpace({ id: spaceId, ...payload })}
    />
  );
}

export function ProjectHeaderEditor({
  projectId,
  name,
  description,
  marker,
  actions,
}: {
  projectId: string;
  name: string;
  description?: string;
  marker?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <HeaderEditor
      name={name}
      description={description}
      marker={marker}
      actions={actions}
      onSave={(payload) => updateProject({ id: projectId, ...payload })}
    />
  );
}

export function DocumentHeaderEditor({
  documentId,
  title,
  actions,
}: {
  documentId: string;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <HeaderEditor
      name={title}
      actions={actions}
      onSave={(payload) => updateDocument({ id: documentId, title: payload.name })}
    />
  );
}