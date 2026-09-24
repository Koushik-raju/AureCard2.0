"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Dropdown } from "@/components/create/entity-menu";
import { Button } from "@/components/ui/button";
import { inboxUnreadCount, latestUnread } from "@/lib/inbox-count";

export function InboxBell() {
  const pathname = usePathname();
  const [count, setCount] = useState(inboxUnreadCount);
  const [latest, setLatest] = useState(latestUnread);

  useEffect(() => {
    const update = () => {
      setCount(inboxUnreadCount());
      setLatest(latestUnread());
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
    };
    // Recompute when navigating: the inbox visit rewrites the snapshot.
  }, [pathname]);

  return (
    // Remount per route so a navigation always dismisses the menu.
    <Dropdown
      key={pathname}
      trigger={
        <Button variant="ghost" size="icon" aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}>
          <span className="relative inline-flex">
            <Bell className="size-4" />
            {count > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-px text-[10px] font-semibold tabular-nums text-primary-foreground">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </span>
        </Button>
      }
    >
      {latest.length === 0 ? (
        <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">
          All caught up.
        </p>
      ) : (
        <ul>
          {latest.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href ?? "/inbox"}
                className="block truncate rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block truncate font-medium">{item.title ?? "Update"}</span>
                <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                  {item.kind}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1 border-t border-border/60 pt-1">
        <Link
          href="/inbox"
          className="block rounded-md px-2.5 py-1.5 text-center text-xs font-medium text-primary hover:bg-muted"
        >
          Open inbox
        </Link>
      </div>
    </Dropdown>
  );
}
