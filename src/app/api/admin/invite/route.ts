export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminClient } from "@/utils/supabase/admin";

export async function POST(req: Request) {
  const { email } = await req.json();

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin config missing" }, { status: 500 });
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
