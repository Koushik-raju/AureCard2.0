import { Suspense } from "react";
import { isDbConfigured } from "@/lib/server-supabase";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm enabled={isDbConfigured} />
    </Suspense>
  );
}