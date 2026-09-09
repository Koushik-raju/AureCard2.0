import { isDbConfigured } from "@/lib/server-supabase";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-sm px-6 py-16 sm:py-24">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="font-serif text-lg font-semibold">A</span>
        </div>
        <h1 className="mt-6 font-serif text-3xl font-medium tracking-tight">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a secure reset link.
        </p>
      </div>

      {!isDbConfigured ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          Password reset needs the Supabase keys in <code className="text-xs">.env.local</code>.
        </div>
      ) : null}

      <ForgotPasswordForm enabled={isDbConfigured} />
    </div>
  );
}