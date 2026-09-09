import Link from "next/link";
import { isDbConfigured } from "@/lib/server-supabase";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-sm px-6 py-16 sm:py-24">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="font-serif text-lg font-semibold">A</span>
        </div>
        <h1 className="mt-6 font-serif text-3xl font-medium tracking-tight">
          Welcome to Atlas
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isDbConfigured
            ? "Sign in to your workspace."
            : "Authentication is off while the workspace runs on sample data."}
        </p>
      </div>

      {!isDbConfigured ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          Set the Supabase keys in <code className="text-xs">.env.local</code> to enable
          login.
        </div>
      ) : null}

      <LoginForm enabled={isDbConfigured} />

      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link
          href="/home"
          className="underline-offset-4 hover:underline"
        >
          Explore the workspace without an account
        </Link>
      </p>
    </div>
  );
}