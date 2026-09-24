import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SpaceTree } from "@/components/layout/space-tree";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { InboxBell } from "@/components/layout/inbox-bell";
import { SearchPalette } from "@/components/search/search-palette";
import { getCurrentUser } from "@/app/actions/auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  // Hard gate: a forged or revoked session cookie passes the fast middleware
  // check but is bounced here via a verified getUser() lookup (request-memoized,
  // so pages below reuse it with no extra round-trip). RLS remains the final
  // backstop at the database.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
      <SidebarProvider>
        <AppSidebar userEmail={user.email ?? "Unknown"} />
        <SpaceTree />
      <SidebarInset className="min-w-0">
        <div className="relative flex h-full flex-col">
          <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="md:hidden" />
            </div>
            <div className="flex items-center gap-1">
              <InboxBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
          <SearchPalette />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
