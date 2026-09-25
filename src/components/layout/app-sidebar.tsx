"use client";

import { Home, FolderKanban, LayoutGrid, ListTodo, FileText, Search, Bot, History, LogOut, MessageSquare, Mic, Inbox, Settings, Building2, Sparkles, GitBranch } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";
import { CreateMenu } from "@/components/layout/create-menu";
import { PREF_KEYS, readJson } from "@/lib/prefs";
import { inboxUnreadCount } from "@/lib/inbox-count";

const NAV_GROUPS = [
  {
    label: "Capture",
    items: [{ label: "Record", href: "/record", icon: Mic }],
  },
  {
    label: "Aure",
    items: [
      { label: "Home", href: "/home", icon: Home },
      { label: "Library", href: "/docs", icon: FileText },
      { label: "Ask", href: "/bot", icon: Bot },
      { label: "Tasks", href: "/tasks", icon: ListTodo },
      { label: "Insights", href: "/insights", icon: Sparkles },
      { label: "Mind map", href: "/mindmap", icon: GitBranch },
      { label: "Spaces", href: "/spaces", icon: LayoutGrid },
      { label: "Inbox", href: "/inbox", icon: Inbox },
      { label: "Messages", href: "/messages", icon: MessageSquare },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Projects", href: "/projects", icon: FolderKanban },
      { label: "Search", href: "/search", icon: Search },
      { label: "History", href: "/history", icon: History },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Organization", href: "/org", icon: Building2 },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Unread badge for the Inbox item, from the last inbox snapshot (no refetch). */
function InboxBadge() {
  const [count, setCount] = useState(inboxUnreadCount);
  useEffect(() => {
    const update = () => setCount(inboxUnreadCount());
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread`}
      className="ml-auto flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary-foreground"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppSidebar({ userEmail }: { userEmail: string | null }) {  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState("");
  useEffect(() => {
    setDisplayName(readJson<{ name: string }>(PREF_KEYS.displayName, { name: "" }).name ?? "");
  }, [pathname]);
  const shownName = userEmail ?? (displayName || "Koushik");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/home" className="gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <span className="font-serif text-sm font-semibold">A</span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-serif text-[15px] font-medium tracking-tight">
                    Aure
                  </span>
                  <span className="text-xs text-muted-foreground">Workspace</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <span className="flex items-center gap-1 px-1">
              <CreateMenu />
              <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                Create
              </span>
            </span>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon className="size-[18px]" />
                        <span>{item.label}</span>
                        {item.href === "/inbox" ? <InboxBadge key={pathname} /> : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-pointer">
              <Avatar className="size-6">
                <AvatarFallback className="bg-secondary text-xs text-muted-foreground">
                  {shownName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-medium">
                {shownName}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {userEmail ? (
            <SidebarMenuItem>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => startTransition(() => signOut())}
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-4" />
                {isPending ? "Signing out…" : "Sign out"}
              </Button>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
