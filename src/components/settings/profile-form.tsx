"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PREF_KEYS, readJson, writeJson } from "@/lib/prefs";

function loadDisplayName(): string {
  return readJson<{ name: string }>(PREF_KEYS.displayName, { name: "" }).name ?? "";
}

/** Fallback display name from the account email ("koushik@…" → "Koushik"). */
function nameFromEmail(email: string | null): string {
  if (!email) return "";
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ProfileForm({ email }: { email: string | null }) {
  const [name, setName] = useState(() => loadDisplayName() || nameFromEmail(email));
  const [saved, setSaved] = useState(false);

  function save() {
    writeJson(PREF_KEYS.displayName, { name: name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-medium tracking-tight">Display name</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown in the sidebar and on your comments when you&apos;re signed out.
          {email ? " While signed in, comments are attributed to your account email." : ""}
        </p>
        <div className="mt-3 max-w-sm space-y-2">
          <Label htmlFor="display-name">Name</Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Koushik"
            maxLength={60}
          />
        </div>
        <Button onClick={save} className="mt-3 min-h-11">
          Save name
        </Button>
        {saved && <p className="mt-2 text-sm text-muted-foreground">Saved.</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-medium tracking-tight">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {email ? `Signed in as ${email}.` : "Not signed in — running on local sample data."}
        </p>
      </div>
    </div>
  );
}
