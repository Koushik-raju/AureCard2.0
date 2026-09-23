import { BotPanel } from "@/components/bot/bot-panel";
import type { TaskItem } from "@/lib/types";
import {
  getSpaces,
  getProjects,
  getTasks,
  getDocuments,
  getDocumentBlocks,
  getTaskItems,
} from "@/lib/repository";

export default async function BotPage() {
  const [spaces, projects, tasks, docs, taskItems, blocks] = await Promise.all([
    getSpaces(),
    getProjects(),
    getTasks(),
    getDocuments(),
    getTaskItems(),
    getDocumentBlocks(),
  ]);

  const itemsByTask: Record<string, TaskItem[]> = {};
  for (const item of taskItems) {
    (itemsByTask[item.taskId] ??= []).push(item);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          Atlas Assistant
        </h1>
        <p className="mt-2 max-w-prose text-[15px] text-muted-foreground">
          A lightweight in-workspace assistant. Ask about your tasks, deadlines,
          priorities, and what was said in recordings and notes — no setup or APIs required.
        </p>
      </header>
      <BotPanel data={{ spaces, projects, tasks, docs, itemsByTask, blocks }} />
    </div>
  );
}