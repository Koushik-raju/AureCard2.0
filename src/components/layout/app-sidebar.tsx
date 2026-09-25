"use client";

import { Home, FolderKanban, LayoutGrid, ListTodo, FileText, Search, Bot, History, LogOut, Mic, Inbox, Settings, Sparkles, GitBranch, Users, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { createGroupThread } from "@/lib/mutations";
import { AssigneeAvatar } from "@/components/tasks/hues";
import type { GroupThread, WorkspaceMember } from "@/lib/types";

const NAV_GROUPS = [
  {
    label: "Capture",
    items: [{ label: "Record", href: "/record", icon: Mic }],
  },
  {
    label: "Aure",
    items: [
      { label: "Home", href: "/home", icon: Home },
      { label: "Ask", href: "/bot", icon: Bot },
      { label: "Library", href: "/docs", icon: FileText },
      { label: "Insights", href: "/insights", icon: Sparkles },
      { label: "Inbox", href: "/inbox", icon: Inbox },
      { label: "Mind map", href: "/mindmap", icon: GitBranch },
      { label: "Search", href: "/search", icon: Search },
      { label: "History", href: "/history", icon: History },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Spaces", href: "/spaces", icon: LayoutGrid },
      { label: "Projects", href: "/projects", icon: FolderKanban },
      { label: "Tasks", href: "/tasks", icon: ListTodo },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

function DirectMessagesGroup({
  directory,
  userEmail,
}: {
  directory: WorkspaceMember[];
  userEmail: string | null;
}) {
  const pathname = usePathname();
  const me = (userEmail ?? "").toLowerCase();
  const people = directory.filter((d) => d.email.toLowerCase() !== me);
  if (people.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Direct messages</SidebarGroupLabel>
      <SidebarMenu>
        {people.map((d) => {
          const href = `/messages?to=${encodeURIComponent(d.email)}`;
          const active = pathname === "/messages";
          return (
            <SidebarMenuItem key={d.id}>
              <SidebarMenuButton asChild isActive={active} tooltip={d.name}>
                <Link href={href}>
                  <AssigneeAvatar name={d.name} size="sm" />
                  <span className="truncate">{d.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function GroupsGroup({
  threads,
  directory,
}: {
  threads: GroupThread[];
  directory: WorkspaceMember[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function togglePick(email: string) {
    setPicked((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  }

  function create() {
    if (!name.trim() || picked.length === 0 || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await createGroupThread({ name: name.trim(), emails: picked });
      if (result.error || !result.id) {
        setError(result.error ?? "Could not create the group.");
        return;
      }
      setOpen(false);
      setName("");
      setPicked([]);
      router.push(`/messages?group=${result.id}`);
      router.refresh();
    });
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <span className="flex w-full items-center justify-between">
          Groups
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            aria-label="New group"
            title="New group"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-3.5" />
          </button>
        </span>
      </SidebarGroupLabel>
      <SidebarMenu>
        {threads.map((t) => (
          <SidebarMenuItem key={t.id}>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/messages"}
              tooltip={t.name}
            >
              <Link href={`/messages?group=${t.id}`}>
                <Users className="size-[18px]" />
                <span className="truncate">{t.name}</span>
                <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                  {t.memberEmails.length}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      {open ? (
        <>
          <span
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="New group"
            className="fixed left-4 top-24 z-50 max-h-[80vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-4 shadow-xl sm:left-[300px]"
          >
            <p className="font-serif text-base font-medium">New group</p>
            <label htmlFor="new-group-name" className="mt-3 block text-xs text-muted-foreground">
              Group name
            </label>
            <input
              id="new-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Launch crew"
              maxLength={80}
              autoFocus
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
            />
            <p className="mt-3 text-xs text-muted-foreground">Members</p>
            <ul className="mt-1 max-h-44 space-y-0.5 overflow-y-auto">
              {directory.map((d) => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={picked.includes(d.email)}
                      onChange={() => togglePick(d.email)}
                      className="size-4 accent-primary"
                    />
                    <AssigneeAvatar name={d.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={create}
                disabled={!name.trim() || picked.length === 0 || isPending}
              >
                {isPending ? "Creating…" : "Create group"}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </SidebarGroup>
  );
}

/** Unread badge for the Inbox item, from the last inbox snapshot (no refetch). */
function InboxBadge() {  const [count, setCount] = useState(inboxUnreadCount);
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

export function AppSidebar({
  userEmail,
  directory,
  threads,
}: {
  userEmail: string | null;
  directory: WorkspaceMember[];
  threads: GroupThread[];
}) {
  const pathname = usePathname();
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
        <DirectMessagesGroup directory={directory} userEmail={userEmail} />
        <GroupsGroup threads={threads} directory={directory} />
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
