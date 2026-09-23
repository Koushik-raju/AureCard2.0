"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentRef, Project, Space, Task, TaskItem } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getDueSoonTasks,
  getDueTodayTasks,
  getOverdueTasks,
  todayKey,
} from "@/lib/due";

type BotData = {
  spaces: Space[];
  projects: Project[];
  tasks: Task[];
  docs: DocumentRef[];
  itemsByTask: Record<string, TaskItem[]>;
};

type Suggestion = { label: string; href: string };
type ChatMessage = { role: "user" | "bot"; text: string; suggestions?: Suggestion[] };

function statusCounts(tasks: Task[]) {
  const counts: Record<string, number> = { todo: 0, "in-progress": 0, "in-review": 0, done: 0 };
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
  return counts;
}

function taskLines(tasks: Task[]): Suggestion[] {
  return tasks.map((t) => ({
    label: t.title,
    href: `/tasks/${t.id}`,
  }));
}

function matchTitle(items: Task[], query: string): Task[] {
  const parts = query.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
  if (parts.length === 0) return [];
  return items.filter((t) => parts.every((p) => t.title.toLowerCase().includes(p)));
}

function respond(input: string, data: BotData): ChatMessage {
  const q = input.trim().toLowerCase();
  const { tasks, projects, spaces, docs } = data;
  const todayIso = todayKey();
  const counts = statusCounts(tasks);
  const active = tasks.filter((t) => t.status !== "done");

  if (/^(hi|hello|hey|yo|hii|hola|good (morning|afternoon|evening))\b/.test(q)) {
    return {
      role: "bot",
      text: `Hello! ${tasks.length} tasks, ${projects.length} projects and ${docs.length} documents are live across ${spaces.length} spaces. Ask me about work — overdue tasks, top priorities, or what to focus on.`,
      suggestions: [
        { label: "What should I focus on?", href: "/bot" },
        { label: "Overdue tasks", href: "/bot" },
      ],
    };
  }

  if (/(help|what can you do|commands|capabilit)/.test(q)) {
    return {
      role: "bot",
      text: "I can look across your workspace and point you at the right place: try asking about overdue or due-soon tasks, high-priority work, projects, documents, or let me suggest what to focus on next.",
      suggestions: [
        { label: "Top priorities", href: "/bot" },
        { label: "Due this week", href: "/bot" },
        { label: "How many tasks?", href: "/bot" },
      ],
    };
  }

  if (/\boverdue\b|fell behind|missed/.test(q)) {
    const overdue = getOverdueTasks(active, todayIso);
    if (overdue.length === 0) {
      return { role: "bot", text: "Nothing is overdue right now." };
    }
    return {
      role: "bot",
      text: `Found ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}:`,
      suggestions: taskLines(overdue),
    };
  }

  if (/due (today|tomorrow)|today|tomorrow/.test(q)) {
    const todayTasks = getDueTodayTasks(active, todayIso);
    const tomorrowTasks = getDueSoonTasks(active, 1, todayIso).filter(
      (t) => t.dueDate !== todayIso
    );
    const candidates = [...todayTasks, ...tomorrowTasks];
    if (candidates.length === 0) {
      return { role: "bot", text: "No tasks are due today or tomorrow." };
    }
    return {
      role: "bot",
      text: `${candidates.length} task${candidates.length === 1 ? "" : "s"} due in the next couple of days:`,
      suggestions: taskLines(candidates),
    };
  }

  if (/due (this week|soon)|this week|upcoming/.test(q)) {
    const upcoming = getDueSoonTasks(active, 7, todayIso);
    if (upcoming.length === 0) {
      return { role: "bot", text: "Nothing due in the next 7 days." };
    }
    return {
      role: "bot",
      text: `${upcoming.length} task${upcoming.length === 1 ? "" : "s"} due in the next 7 days:`,
      suggestions: taskLines(upcoming),
    };
  }

  if (/(high|top|urgent) +priority|priorit|most important|what should i (do|work|focus)|\bnext\b|recommend|suggest/.test(q)) {
    const sorted = [...active].sort((a, b) => {
      const prio = { high: 0, medium: 1, low: 2 } as Record<string, number>;
      const rank = (p?: string) => (p ? (prio[p] ?? 3) : 3);
      return rank(a.priority) - rank(b.priority);
    });
    const ranked = sorted.filter((t) => t.status === "in-progress" || t.priority === "high");
    const top = (ranked.length > 0 ? ranked : sorted).slice(0, 3);
    if (top.length === 0) {
      return { role: "bot", text: "There's nothing on your plate right now. Enjoy the calm!" };
    }
    return {
      role: "bot",
      text: `My suggestion, in order of impact:`,
      suggestions: taskLines(top),
    };
  }

  if (/how many tasks|\btask counts\b|statistics|\bcount\b.*\btask|tasks.*(count|stats)/.test(q)) {
    const pct = tasks.length > 0 ? Math.round((counts.done / tasks.length) * 100) : 0;
    return {
      role: "bot",
      text: `Across ${tasks.length} tasks: ${counts.todo} to do, ${counts["in-progress"]} in progress, ${counts["in-review"]} in review, ${counts.done} done (${pct}% finished).`,
      suggestions: [{ label: "View all tasks", href: "/tasks" }],
    };
  }

  if (/\bprojects?\b/.test(q)) {
    if (projects.length === 0) {
      return { role: "bot", text: "No projects yet — create one when you're ready." };
    }
    return {
      role: "bot",
      text: `You have ${projects.length} projects:`,
      suggestions: projects.slice(0, 6).map((p) => ({
        label: p.name,
        href: `/projects/${p.id}`,
      })),
    };
  }

  if (/\bspaces?\b/.test(q)) {
    if (spaces.length === 0) {
      return { role: "bot", text: "No spaces yet." };
    }
    return {
      role: "bot",
      text: `You have ${spaces.length} spaces:`,
      suggestions: spaces.map((s) => ({
        label: s.name,
        href: `/spaces/${s.id}`,
      })),
    };
  }

  if (/\bdocs?\b|documents|notes/.test(q)) {
    if (docs.length === 0) {
      return { role: "bot", text: "No documents yet." };
    }
    return {
      role: "bot",
      text: `${docs.length} documents in your library. The most recent:`,
      suggestions: docs.slice(0, 6).map((d) => ({
        label: d.title,
        href: `/docs/${d.id}`,
      })),
    };
  }

  const fuzzyTasks = matchTitle(tasks, q);
  if (fuzzyTasks.length > 0) {
    return {
      role: "bot",
      text: `Found ${fuzzyTasks.length} matching task${fuzzyTasks.length === 1 ? "" : "s"}:`,
      suggestions: taskLines(fuzzyTasks.slice(0, 8)),
    };
  }
  const fuzzyProjects = projects.filter((p) => p.name.toLowerCase().includes(q.trim()));
  if (fuzzyProjects.length > 0) {
    return {
      role: "bot",
      text: "That matches a project:",
      suggestions: fuzzyProjects.slice(0, 4).map((p) => ({
        label: p.name,
        href: `/projects/${p.id}`,
      })),
    };
  }
  const fuzzySpaces = spaces.filter((s) => s.name.toLowerCase().includes(q.trim()));
  if (fuzzySpaces.length > 0) {
    return {
      role: "bot",
      text: "That matches a space:",
      suggestions: fuzzySpaces.slice(0, 4).map((s) => ({
        label: s.name,
        href: `/spaces/${s.id}`,
      })),
    };
  }

  return {
    role: "bot",
    text: "I didn't spot anything relevant. Try one of these to get a useful answer:",
    suggestions: [
      { label: "What should I focus on?", href: "/bot" },
      { label: "Overdue tasks", href: "/bot" },
      { label: "Due this week", href: "/bot" },
      { label: "How many tasks?", href: "/bot" },
    ],
  };
}

const QUICK_PROMPTS = [
  "What should I focus on?",
  "Overdue tasks",
  "Due this week",
  "Top priorities",
];

export function BotPanel({ data }: { data: BotData }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: "bot",
      text: "Hi — I can read your workspace and point you at the right work. Ask me anything.",
    },
  ]);
  const [value, setValue] = useState("");

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const reply = respond(trimmed, data);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }, reply]);
    setValue("");
  }

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pb-6">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex items-start gap-3", m.role === "user" && "justify-end")}>
            {m.role === "bot" ? (
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </span>
            ) : null}
            <div
              className={cn(
                "max-w-[75%] rounded-2xl border px-4 py-2.5 text-sm leading-relaxed",
                m.role === "bot"
                  ? "border-border bg-card text-foreground"
                  : "border-primary/20 bg-primary/10 text-foreground"
              )}
            >
              <p>{m.text}</p>
              {m.suggestions && m.suggestions.length > 0 ? (
                <ul className="mt-2.5 space-y-1">
                  {m.suggestions.map((s) => (
                    <li key={s.href + s.label} className="flex items-center gap-2">
                      <span className="size-1 shrink-0 rounded-full bg-primary/60" />
                      {s.href === "/bot" ? (
                        <button
                          type="button"
                          onClick={() => send(s.label)}
                          className="inline-flex items-center gap-1 text-left text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        >
                          {s.label}
                          <ArrowRight className="size-3" />
                        </button>
                      ) : (
                        <Link
                          href={s.href}
                          className="inline-flex items-center gap-1 text-left text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        >
                          {s.label}
                          <ArrowRight className="size-3" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {m.role === "user" ? (
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <User className="size-4" />
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Sparkles className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Try:</span>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => send(prompt)}
              className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {prompt}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(value);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask about your workspace…"
            aria-label="Ask Atlas"
            className="h-11"
          />
          <Button type="submit" size="lg" disabled={!value.trim()}>
            Ask
          </Button>
        </form>
      </div>
    </div>
  );
}