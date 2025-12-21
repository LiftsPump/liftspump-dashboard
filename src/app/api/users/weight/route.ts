import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const adminClient = () =>
  createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

type WeightEntryRow = {
  id: string;
  creator_id: string;
  created_at: string;
  weight_kg: number | null;
  source: string | null;
  bf_percent: number | null;
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

  const { data: entries, error: entriesError } = await admin
    .from("weight_entry")
    .select("id, creator_id, created_at, weight_kg, source, bf_percent")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false })
    .limit(90);

  if (entriesError) {
    return NextResponse.json({ error: entriesError.message }, { status: 500 });
  }

  const orderedEntries = (entries ?? []).slice().reverse() as WeightEntryRow[];

  const { data: rateRow, error: rateError } = await admin
    .from("ratelimits")
    .select("weight_analysis, date")
    .eq("creator_id", userId)
    .not("weight_analysis", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rateError && rateError.code !== "PGRST116") {
    return NextResponse.json({ error: rateError.message }, { status: 500 });
  }

  const responsePayload = {
    entries: orderedEntries,
    insight: rateRow?.weight_analysis ?? null,
    generated_at: rateRow?.date ?? null,
  };

  return NextResponse.json(responsePayload);
}
