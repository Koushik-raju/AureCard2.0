"use client";

import { Home, FolderKanban, LayoutGrid, ListTodo, FileText, Search, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

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

const NAV_ITEMS = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Spaces", href: "/spaces", icon: LayoutGrid },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Docs", href: "/docs", icon: FileText },
  { label: "Search", href: "/search", icon: Search },
];

export function AppSidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

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
                    Atlas
                  </span>
                  <span className="text-xs text-muted-foreground">Workspace</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon className="size-[18px]" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-pointer">
              <Avatar className="size-6">
                <AvatarFallback className="bg-secondary text-xs text-muted-foreground">
                  {userEmail ? userEmail.slice(0, 2).toUpperCase() : "KO"}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-medium">
                {userEmail ?? "Koushik"}
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
