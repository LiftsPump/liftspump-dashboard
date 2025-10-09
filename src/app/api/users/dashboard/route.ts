import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/utils/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();

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

  const { data: trainerRows, error: trainerError } = await supabase
    .from("trainer")
    .select("creator_id, trainer_id, subs, routines")
    .eq("creator_id", user.id)
    .limit(1);

  if (trainerError) {
    return NextResponse.json({ error: trainerError.message }, { status: 500 });
  }

  const trainerRow = trainerRows?.[0] ?? null;
  if (!trainerRow) {
    return NextResponse.json(
      {
        trainerId: null,
        subs: [],
        profiles: [],
        trainerRoutines: [],
      },
      { status: 200 }
    );
  }

  const subsList = Array.isArray(trainerRow.subs) ? (trainerRow.subs as string[]) : [];

  let profiles: any[] = [];
  if (subsList.length) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profile")
      .select(
        "creator_id, first_name, last_name, email, username, type, last_synced, height, weight"
      )
      .in("creator_id", subsList);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    profiles = profileRows ?? [];
  }

  const { data: trainerRoutines, error: routineError } = await supabase
    .from("routines")
    .select("id, name, type, text, picture, days, weekly, date, duration, creator_id")
    .eq("creator_id", user.id)
    .eq("type", "trainer")
    .order("date", { ascending: false });

  if (routineError) {
    return NextResponse.json({ error: routineError.message }, { status: 500 });
  }

  return NextResponse.json({
    trainerId: (trainerRow.trainer_id as string) || null,
    subs: subsList,
    profiles,
    trainerRoutines: trainerRoutines ?? [],
  });
}
