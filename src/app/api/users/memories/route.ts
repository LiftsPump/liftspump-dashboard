import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const adminClient = () =>
  createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

const clampConfidence = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 100) / 100;
};

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const admin = adminClient();
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trainerRow, error: trainerError } = await supabase
    .from("trainer")
    .select("subs")
    .eq("creator_id", user.id)
    .maybeSingle();

  if (trainerError) {
    return NextResponse.json({ error: trainerError.message }, { status: 500 });
  }

  const subs = Array.isArray(trainerRow?.subs)
    ? (trainerRow?.subs as string[])
    : [];

  if (!subs.includes(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("memories")
    .select("id, creator_id, text, type, created_at, confidence")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ memories: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const admin = adminClient();
  const body = await req.json().catch(() => ({}));
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const jwt = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  if (!jwt) {
    return NextResponse.json({ error: "Missing auth session" }, { status: 401 });
  }

  const memoryId =
    typeof body?.memory_id === "string" ? body.memory_id.trim() : null;
  const direction =
    body?.direction === "up" || body?.direction === "down"
      ? (body.direction as "up" | "down")
      : null;

  if (!memoryId || !direction) {
    return NextResponse.json(
      { error: "memory_id and direction (up|down) required" },
      { status: 400 }
    );
  }

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(jwt);

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trainerRow, error: trainerError } = await admin
    .from("trainer")
    .select("subs")
    .eq("creator_id", user.id)
    .maybeSingle();

  if (trainerError) {
    return NextResponse.json({ error: trainerError.message }, { status: 500 });
  }

  const subs = Array.isArray(trainerRow?.subs)
    ? (trainerRow?.subs as string[])
    : [];

  const { data: memoryRow, error: memoryError } = await admin
    .from("memories")
    .select("id, creator_id, confidence, text, type, created_at")
    .eq("id", memoryId)
    .maybeSingle();

  if (memoryError) {
    return NextResponse.json({ error: memoryError.message }, { status: 500 });
  }

  if (!memoryRow) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  if (!subs.includes(memoryRow.creator_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = Number(memoryRow.confidence ?? 0);
  const delta = direction === "up" ? 0.2 : -0.2;
  const nextValue = clampConfidence(current + delta);

  const { data: updatedRows, error: updateError } = await admin
    .from("memories")
    .update({ confidence: nextValue })
    .eq("id", memoryId)
    .select("id, creator_id, text, type, created_at, confidence");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const updated = updatedRows?.[0] ?? null;

  return NextResponse.json({ memory: updated });
}
