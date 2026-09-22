"use client";

import { useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/lib/mutations";
import { Input } from "@/components/ui/input";
import { CreateButton, Field, FormActions, SelectField } from "./inline-create";
import type { Space } from "@/lib/types";

export function CreateProjectButton({
  spaces,
  defaultSpaceId,
}: {
  spaces: Space[];
  defaultSpaceId?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState(defaultSpaceId ?? "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createProject({ name, spaceId, description });
      if (result.error) {
        setError(result.error);
      } else if (result.id) {
        router.push(`/projects/${result.id}`);
      }
      router.refresh();
    });
  }

  return (
    <CreateButton label="New project" description="Add a project to one of your spaces.">
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mobile app v2"
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
          <Field label="Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project?"
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <FormActions
            onCancel={close}
            isPending={isPending}
            submitLabel="Create project"
          />
        </form>
      )}
    </CreateButton>
  );
}