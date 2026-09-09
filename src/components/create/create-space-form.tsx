"use client";

import { useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSpace } from "@/lib/mutations";
import { Input } from "@/components/ui/input";
import { CreateButton, Field, FormActions } from "./inline-create";
import type { Accent } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCENTS: { value: Accent; label: string }[] = [
  { value: "orange", label: "Orange" },
  { value: "amber", label: "Amber" },
  { value: "olive", label: "Olive" },
  { value: "clay", label: "Clay" },
  { value: "sage", label: "Sage" },
  { value: "ink", label: "Ink" },
];

export function CreateSpaceButton() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState<Accent>("orange");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createSpace({ name, description, accent });
      if (result.error) {
        setError(result.error);
      } else if (result.id) {
        router.push(`/spaces/${result.id}`);
      }
      router.refresh();
    });
  }

  return (
    <CreateButton label="New space" description="Create a new working context.">
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
              placeholder="e.g. Design"
              required
              autoFocus
            />
          </Field>
          <Field label="Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What lives here?"
            />
          </Field>
          <Field label="Accent">
            <div className="flex flex-wrap gap-1.5">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAccent(a.value)}
                  aria-pressed={accent === a.value}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    accent === a.value
                      ? "border-foreground bg-muted text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <FormActions
            onCancel={close}
            isPending={isPending}
            submitLabel="Create space"
          />
        </form>
      )}
    </CreateButton>
  );
}