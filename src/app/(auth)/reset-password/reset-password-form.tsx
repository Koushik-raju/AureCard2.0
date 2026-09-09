"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordWithCode } from "@/app/actions/auth";

export function ResetPasswordForm({ enabled }: { enabled: boolean }) {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!code) {
      setError("This reset link is missing a code. Open the link from your email.");
      return;
    }
    startTransition(async () => {
      const result = await resetPasswordWithCode(code, password);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-16 sm:py-24">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="font-serif text-lg font-semibold">A</span>
        </div>
        <h1 className="mt-6 font-serif text-3xl font-medium tracking-tight">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick something strong and make it count.
        </p>
      </div>

      {!enabled ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          Password reset needs the Supabase keys in{" "}
          <code className="text-xs">.env.local</code>.
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={!enabled || isPending}>
          {isPending ? "Saving…" : "Set password"}
          <KeyRound className="size-4" />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}