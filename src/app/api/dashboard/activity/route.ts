import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const adminClient = () =>
  createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function GET() {
  const supabase = createServerSupabase();
  const admin = adminClient();

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

  if (!subs.length) {
    return NextResponse.json({ activity: [] });
  }

  const { data: routines, error: routinesError } = await admin
    .from("routines")
    .select("id, name, type, date, duration, creator_id")
    .in("creator_id", subs)
    .in("type", ["date"])
    .not("date", "is", null)
    .order("date", { ascending: false })
    .limit(20);

  if (routinesError) {
    return NextResponse.json({ error: routinesError.message }, { status: 500 });
  }

  const userIds = Array.from(
    new Set((routines ?? []).map((r) => r.creator_id).filter(Boolean))
  ) as string[];

  let names = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles, error: profileError } = await admin
      .from("profile")
      .select("creator_id, first_name, last_name, username, email")
      .in("creator_id", userIds);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    names = new Map(
      (profiles ?? []).map((p: any) => {
        const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
        const fallback = p.username || p.email || p.creator_id || "Client";
        return [p.creator_id as string, full || fallback];
      })
    );
  }

  const activity = (routines ?? []).map((r: any) => ({
    id: r.id as string,
    routineName: r.name || "Workout",
    type: r.type || "session",
    date: r.date as string,
    clientId: r.creator_id as string,
    clientName: names.get(r.creator_id as string) || "Client",
    duration: typeof r.duration === "number" ? r.duration : null,
  }));

  return NextResponse.json({ activity });
}
