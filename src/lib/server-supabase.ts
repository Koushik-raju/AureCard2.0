import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const SUPABASE_KEY = PUBLISHABLE_KEY || ANON_KEY;
export { SUPABASE_KEY };

/** True when the Supabase env vars are set. Until then the app runs on sample data. */
export const isDbConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/**
 * Cookie-aware Supabase client for use in Server Components and Server Functions.
 * Always create a new instance per render/request.
 */
export function createServerSupabase(): SupabaseClient | null {
  if (!isDbConfigured) return null;
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      async getAll() {
        return (await cookies()).getAll();
      },
      async setAll(cookiesToSet) {
        try {
          const store = await cookies();
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Setting cookies is only allowed from Server Functions / Route
          // Handlers. Swallow here so reads never crash.
        }
      },
    },
  });
}