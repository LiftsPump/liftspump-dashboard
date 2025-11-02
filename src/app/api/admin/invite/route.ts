export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  const { email } = await req.json();

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const user = data?.user ?? null;

  if (user?.id) {
    try {
      await supabase
        .from("profile")
        .upsert(
          {
            creator_id: user.id,
            email: normalizedEmail,
          },
          { onConflict: "creator_id" }
        );
    } catch (profileError: any) {
      console.warn("Failed to upsert profile for invited user", profileError?.message || profileError);
    }
  }

  return NextResponse.json({ user });
}
