"use client";

import { useState } from "react";
import { useTransition } from "react";
import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/app/actions/auth";

export function LoginForm({ enabled }: { enabled: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: "in" | "up", formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await (action === "in" ? signIn : signUp)(
        formData.get("email") as string,
        formData.get("password") as string
      );
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mt-8 space-y-4">
      <form
        action={(formData) => run("in", formData)}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={!enabled || isPending}
        >
          {isPending ? "Working…" : "Sign in"}
          <LogIn className="size-4" />
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide text-muted-foreground">
          <span className="bg-background px-2">New here?</span>
        </div>
      </div>

      <form action={(formData) => run("up", formData)}>
        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={!enabled || isPending}
        >
          <UserPlus className="size-4" />
          Create an account
        </Button>
      </form>
    </div>
  );
}