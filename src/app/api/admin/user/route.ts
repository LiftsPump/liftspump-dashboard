export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfigured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }
  const admin = createAdminClient(supabaseUrl, serviceKey);
  const emailParam = req.nextUrl.searchParams.get("email");
  const userIdParam = req.nextUrl.searchParams.get("user_id");

  if (!emailParam && !userIdParam) {
    return NextResponse.json({ error: "email or user_id required" }, { status: 400 });
  }

  const normalizedEmail = emailParam ? emailParam.trim().toLowerCase() : null;
  const normalizedUserId = userIdParam ? userIdParam.trim() : null;

  try {
    let user = null as any;
    let lookupId = normalizedUserId ?? null;

    if (lookupId) {
      const { data, error } = await admin.auth.admin.getUserById(lookupId);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    if (!user && normalizedEmail) {
      const { data: profileResult } = await admin
        .from("profile")
        .select("creator_id")
        .eq("email", normalizedEmail)
        .limit(1)
        .single();
      lookupId = profileResult?.creator_id as string | undefined ?? null;
      if (lookupId) {
        const { data, error } = await admin.auth.admin.getUserById(lookupId);
        if (!error && data?.user) {
          user = data.user;
        }
      }
    }

    if (!user && !lookupId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: profileRows } = await admin
      .from("profile")
      .select("creator_id, first_name, last_name, username, email, trainer")
      .eq("creator_id", lookupId)
      .limit(1);
    const profile = profileRows?.[0] ?? null;

    const { data: trainerRows } = await admin
      .from("trainer")
      .select("trainer_id, creator_id, display_name, bio, subs")
      .eq("creator_id", lookupId)
      .limit(1);
    const trainer = trainerRows?.[0] ?? null;

    let routines: any[] = [];
    if (lookupId) {
      const { data: routineRows } = await admin
        .from("routines")
        .select("id, name, text, duration, type, date, days, weekly, created_at")
        .eq("creator_id", lookupId)
        .eq("type", "trainer")
        .order("created_at", { ascending: false })
        .limit(50);
      routines = routineRows ?? [];
    }

    let members: any[] = [];
    if (Array.isArray(trainer?.subs) && trainer!.subs.length) {
      const { data: memberProfiles } = await admin
        .from("profile")
        .select("creator_id, first_name, last_name, username, email")
        .in("creator_id", trainer!.subs as string[]);
      members = memberProfiles ?? [];
    }

    return NextResponse.json({
      user,
      profile,
      trainer,
      routines,
      members,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unable to fetch user" }, { status: 500 });
  }
}
