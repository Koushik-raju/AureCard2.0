import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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
      <SidebarInset>
        <div className="relative flex h-full flex-col">
          <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <span className="truncate text-xs font-medium tracking-wide text-muted-foreground">
                {`Signed in as ${user.email ?? "Unknown"}`}
              </span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
