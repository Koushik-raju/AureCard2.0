"use client";

import { useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDocument } from "@/lib/mutations";
import { Input } from "@/components/ui/input";
import { CreateButton, Field, FormActions, SelectField } from "./inline-create";
import type { Space } from "@/lib/types";

export function CreateDocumentButton({
  spaces,
  defaultProjectId,
}: {
  spaces: Space[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [kind, setKind] = useState<"doc" | "note">("doc");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createDocument({
        title,
        spaceId,
        projectId: defaultProjectId,
        kind,
      });
      if (result.error) {
        setError(result.error);
      } else if (result.id) {
        router.push(`/docs/${result.id}`);
      }
      router.refresh();
    });
  }

  return (
    <CreateButton label="New doc" description="Start a document or a quick note.">
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint notes"
              required
              autoFocus
            />
          </Field>
          <SelectField
            label="Space"
            name="space"
            value={spaceId}
            onChange={setSpaceId}
            placeholder="Pick a space"
            required
            options={spaces.map((s) => ({ value: s.id, label: s.name }))}
          />
          <SelectField
            label="Type"
            name="kind"
            value={kind}
            onChange={(v) => setKind(v as "doc" | "note")}
            options={[
              { value: "doc", label: "Document" },
              { value: "note", label: "Note" },
            ]}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <FormActions
            onCancel={close}
            isPending={isPending}
            submitLabel="Create document"
          />
        </form>
      )}
    </CreateButton>
  );
}