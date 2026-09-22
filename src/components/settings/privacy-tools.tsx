"use client";

import { useState, useTransition } from "react";
import { Download, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";
import { clearLocalWorkspaceData } from "@/lib/prefs";

export function PrivacyTools({ email }: { email: string | null }) {
  const [cleared, setCleared] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function clearLocal() {
    setCleared(clearLocalWorkspaceData());
    setConfirming(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-medium tracking-tight">Export everything</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Download all spaces, tasks, notes, transcripts, comments and history
          as a single JSON file. Recordings stored in cloud Storage are
          referenced by URL; recordings kept in this browser are embedded.
        </p>
        <Button asChild className="mt-3 min-h-11">
          <a href="/api/export" download="atlas-export.json">
            <Download className="size-4" /> Export as JSON
          </a>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-medium tracking-tight">Local data</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Voice prefs, display name, plan choice, org chart and inbox read-state
          live in this browser. Clearing them resets this device to defaults —
          your workspace data is untouched.
        </p>
        {confirming ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="destructive" onClick={clearLocal} className="min-h-11">
              <Trash2 className="size-4" /> Yes, clear local data
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)} className="min-h-11">
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setConfirming(true)} className="mt-3 min-h-11">
            <Trash2 className="size-4" /> Clear local data
          </Button>
        )}
        {cleared && (
          <p className="mt-2 text-sm text-muted-foreground">
            {cleared.length === 0
              ? "No local data was stored on this device."
              : `Cleared ${cleared.length} stored ${cleared.length === 1 ? "item" : "items"}.`}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-medium tracking-tight">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {email ?? "unknown"}. To permanently delete your
          workspace account and cloud data, contact support — deletion is
          confirmed by email and completes within 7 days.
        </p>
        <Button
          variant="outline"
          disabled={isPending}
          onClick={() => startTransition(() => signOut())}
          className="mt-3 min-h-11"
        >
          <LogOut className="size-4" /> {isPending ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </div>
  );
}
