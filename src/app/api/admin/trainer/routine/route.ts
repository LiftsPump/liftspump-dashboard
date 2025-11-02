export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfigured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const { trainer_id, user_id, name, text, duration } = await req.json();

  if (!trainer_id || !user_id || !name) {
    return NextResponse.json({ error: "trainer_id, user_id, and name are required" }, { status: 400 });
  }

  try {
    let durationValue: number | null = null;
    if (typeof duration === "number" && Number.isFinite(duration)) {
      durationValue = duration;
    } else if (typeof duration === "string" && duration.trim()) {
      const parsed = Number(duration);
      if (Number.isFinite(parsed)) durationValue = parsed;
    }

    const insertPayload = {
      name,
      text: text || null,
      duration: durationValue,
      type: "trainer",
      creator_id: trainer_id,
      picture: null,
      days: null,
      weekly: null,
      date: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("routines")
      .insert(insertPayload)
      .select("id, name, text, duration, type, date, created_at")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ routine: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unable to create routine" }, { status: 500 });
  }
}
