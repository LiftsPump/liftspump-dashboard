"use client";
import { ReactNode } from "react";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Ensure a true singleton across HMR/fast refresh by storing on globalThis
const globalForSupabase = globalThis as unknown as {
  __supabase?: SupabaseClient;
};

const supabase: SupabaseClient =
  globalForSupabase.__supabase ??
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true } }
  );

// Cache the instance during development to survive module reloads
if (process.env.NODE_ENV !== "production") {
  globalForSupabase.__supabase = supabase;
}

export default function SupabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      {children}
    </SessionContextProvider>
  );
}
