"use client";

import { useState } from "react";
import { PREF_KEYS, readJson, writeJson } from "@/lib/prefs";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

function loadPrefs(): NotificationPrefs {
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...readJson<Partial<NotificationPrefs>>(PREF_KEYS.notifications, {}),
  };
}

const ROWS: {
  key: keyof Omit<NotificationPrefs, "includeMine">;
  title: string;
  desc: string;
}[] = [
  { key: "assignment", title: "Assignments", desc: "Tasks assigned for you to work on." },
  { key: "comment", title: "Comments", desc: "New comments on your tasks." },
  { key: "due", title: "Due dates", desc: "Overdue and upcoming due dates." },
  { key: "activity", title: "Activity", desc: "Status changes, edits and subtask updates." },
];

export function NotificationForm() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);

  function set(key: keyof NotificationPrefs, value: boolean) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      writeJson(PREF_KEYS.notifications, next);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-medium tracking-tight">Inbox events</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose what lands in your inbox. Changes save automatically.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {ROWS.map((row) => (
            <li key={row.key} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">{row.title}</p>
                <p className="text-sm text-muted-foreground">{row.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[row.key]}
                aria-label={row.title}
                onClick={() => set(row.key, !prefs[row.key])}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  prefs[row.key] ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-0.5 size-5 rounded-full bg-card shadow transition-all",
                    prefs[row.key] ? "left-[22px]" : "left-0.5"
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-medium tracking-tight">Own actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          By default your own comments and edits stay out of the inbox.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">Include my own actions</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.includeMine}
            aria-label="Include my own actions"
            onClick={() => set("includeMine", !prefs.includeMine)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              prefs.includeMine ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-0.5 size-5 rounded-full bg-card shadow transition-all",
                prefs.includeMine ? "left-[22px]" : "left-0.5"
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
