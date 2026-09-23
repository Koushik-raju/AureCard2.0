"use server";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase, isDbConfigured } from "@/lib/server-supabase";

export type AuthResult = { error?: string };

/** Request-memoized: layout + page calling this in one render share one lookup. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!isDbConfigured) return null;
  const client = createServerSupabase();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isDbConfigured) return { error: "Database not configured yet." };
  const client = createServerSupabase();
  if (!client) return { error: "Database not configured yet." };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Incorrect email or password." };
  }
  redirect("/home");
}

export async function signUp(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isDbConfigured) return { error: "Database not configured yet." };
  const client = createServerSupabase();
  if (!client) return { error: "Database not configured yet." };
  const { error } = await client.auth.signUp({ email, password });
  if (error) {
    return { error: error.message };
  }
  redirect("/home");
}

export async function signOut(): Promise<void> {
  const client = createServerSupabase();
  if (client) {
    await client.auth.signOut();
  }
  redirect("/login");
}

/** Sends a password-reset email with a link back to /reset-password. */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!isDbConfigured) return { error: "Database not configured yet." };
  const client = createServerSupabase();
  if (!client) return { error: "Database not configured yet." };
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/reset-password", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").toString(),
  });
  if (error) {
    return { error: error.message };
  }
  return {};
}

/** Exchanges the reset code and sets a new password. */
export async function resetPasswordWithCode(
  code: string,
  password: string
): Promise<AuthResult> {
  if (!isDbConfigured) return { error: "Database not configured yet." };
  const client = createServerSupabase();
  if (!client) return { error: "Database not configured yet." };
  const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return { error: "This reset link is invalid or has expired." };
  }
  const { error: updateError } = await client.auth.updateUser({ password });
  if (updateError) {
    return { error: updateError.message };
  }
  redirect("/home");
}