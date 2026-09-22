"use client";

import { useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/lib/mutations";
import { parseAssignees } from "@/lib/assignees";
import { Input } from "@/components/ui/input";
import { CreateButton, Field, FormActions, SelectField } from "./inline-create";
import type { Project, Space, TaskPriority, TaskStatus } from "@/lib/types";

export function CreateTaskButton({
  spaces,
  projects,
  defaultSpaceId,
  defaultProjectId,
}: {
  spaces: Space[];
  projects: Project[];
  defaultSpaceId?: string;
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState(defaultSpaceId ?? "");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [assignees, setAssignees] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const scopedProjects = projects.filter(
    (p) => !spaceId || p.spaceId === spaceId
  );

  function submit() {
    setError(null);
    startTransition(async () => {
      const list = parseAssignees(assignees);
      const result = await createTask({
        title,
        spaceId,
        projectId: projectId || undefined,
        status,
        priority: priority || undefined,
        assignees: list.length > 0 ? list : undefined,
      });
      if (result.error) {
        setError(result.error);
      } else if (result.id) {
        router.push(`/tasks/${result.id}`);
      }
      router.refresh();
    });
  }

  return (
    <CreateButton label="New task" description="Add a task to a space.">
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
              placeholder="What needs doing?"
              required
              autoFocus
            />
          </Field>
          <SelectField
            label="Space"
            name="space"
            value={spaceId}
            onChange={(v) => {
              setSpaceId(v);
              setProjectId("");
            }}
            placeholder="Pick a space"
            required
            options={spaces.map((s) => ({ value: s.id, label: s.name }))}
          />
          <SelectField
            label="Project"
            name="project"
            value={projectId}
            onChange={setProjectId}
            placeholder="No project"
            options={scopedProjects.map((p) => ({ value: p.id, label: p.name }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Status"
              name="status"
              value={status}
              onChange={(v) => setStatus(v as TaskStatus)}
              options={[
                { value: "todo", label: "To Do" },
                { value: "in-progress", label: "In Progress" },
                { value: "in-review", label: "In Review" },
                { value: "done", label: "Done" },
              ]}
            />
            <SelectField
              label="Priority"
              name="priority"
              value={priority}
              onChange={(v) => setPriority(v as TaskPriority | "")}
              placeholder="None"
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ]}
            />
          </div>
          <Field label="Assignees">
            <Input
              value={assignees}
              onChange={(e) => setAssignees(e.target.value)}
              placeholder="Koushik, Rashmi…"
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <FormActions
            onCancel={close}
            isPending={isPending}
            submitLabel="Create task"
          />
        </form>
      )}
    </CreateButton>
  );
}