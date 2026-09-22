"use client";

import { useEffect, useEffectEvent } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase-client";
import type { TaskComment, TaskStatus } from "@/lib/types";

type RealtimeHandlers = {
  onStatus: (status: TaskStatus) => void;
  onComment: (comment: TaskComment) => void;
  onItemDone: (itemId: string, done: boolean) => void;
};

type TaskRow = { status?: TaskStatus };
type CommentRow = { id: string; author: string; text: string; created_at: string };
type ItemRow = { id: string; done: boolean };

const recentCommentEchoes = new Map<string, number>();

export function isRecentCommentEcho(author: string, text: string) {
  const key = `${author}\u0000${text}`;
  const ts = recentCommentEchoes.get(key);
  if (ts === undefined) return false;
  if (Date.now() - ts > 15_000) {
    recentCommentEchoes.delete(key);
    return false;
  }
  return true;
}

export function trackCommentEcho(author: string, text: string) {
  recentCommentEchoes.set(`${author}\u0000${text}`, Date.now());
}

export function useRealtimeTask(taskId: string, handlers: RealtimeHandlers) {
  const onStatus = useEffectEvent(handlers.onStatus);
  const onComment = useEffectEvent(handlers.onComment);
  const onItemDone = useEffectEvent(handlers.onItemDone);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`task-live-${taskId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${taskId}` },
        (payload: RealtimePostgresChangesPayload<TaskRow>) => {
          const next = payload.new as TaskRow;
          if (next.status) onStatus(next.status);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_comments",
          filter: `task_id=eq.${taskId}`,
        },
        (payload: RealtimePostgresChangesPayload<CommentRow>) => {
          const row = payload.new as CommentRow;
          if (!row.text) return;
          if (isRecentCommentEcho(row.author, row.text)) return;
          onComment({
            id: row.id,
            taskId,
            author: row.author,
            text: row.text,
            createdAt: row.created_at,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "task_items",
          filter: `task_id=eq.${taskId}`,
        },
        (payload: RealtimePostgresChangesPayload<ItemRow>) => {
          const row = payload.new as ItemRow;
          onItemDone(row.id, row.done);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);
}