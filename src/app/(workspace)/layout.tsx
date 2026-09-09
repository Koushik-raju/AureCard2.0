import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getCurrentUser } from "@/app/actions/auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <SidebarProvider>
      <AppSidebar userEmail={user?.email ?? null} />
      <SidebarInset>
        <div className="flex h-full flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
            <span className="text-xs font-medium tracking-wide text-muted-foreground">
              {user ? `Signed in as ${user.email}` : "Personal Workspace"}
            </span>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
