import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { RecordFab } from "@/components/layout/record-fab";
import { getCurrentUser } from "@/app/actions/auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <SidebarProvider>
      <AppSidebar userEmail={user?.email ?? null} />
      <SidebarInset>
        <div className="relative flex h-full flex-col">
          <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <span className="truncate text-xs font-medium tracking-wide text-muted-foreground">
                {user ? `Signed in as ${user.email}` : "Personal Workspace"}
              </span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
          <RecordFab />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
