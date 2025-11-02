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

  const { trainer_id, member_email, member_id } = await req.json();

  if (!trainer_id || (!member_email && !member_id)) {
    return NextResponse.json(
      { error: "trainer_id and member_email or member_id required" },
      { status: 400 }
    );
  }

  try {
    const { data: trainerRows, error: trainerError } = await admin
      .from("trainer")
      .select("trainer_id, subs")
      .eq("trainer_id", trainer_id)
      .limit(1);

    if (trainerError) throw new Error(trainerError.message);
    const trainer = trainerRows?.[0];
    if (!trainer) return NextResponse.json({ error: "Trainer not found" }, { status: 404 });

    let memberId: string | null = null;

    if (member_id) {
      memberId = String(member_id);
      const { data: existsUser, error: userErr } = await admin
        .from("profile")
        .select("creator_id")
        .eq("creator_id", memberId)
        .limit(1)
        .single();
      if (userErr || !existsUser?.creator_id) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }
    } else if (member_email) {
      const email = String(member_email).trim().toLowerCase();
      const { data: memberData, error: memberError } = await admin
        .from("profile")
        .select("creator_id")
        .eq("email", email)
        .limit(1)
        .single();
      if (memberError || !memberData?.creator_id) {
        const message = memberError?.message || "Member not found";
        return NextResponse.json({ error: message }, { status: 404 });
      }
      memberId = memberData.creator_id as string;
    }

    if (!memberId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const currentSubs = Array.isArray(trainer.subs) ? trainer.subs as string[] : [];
    const subsSet = new Set(currentSubs);
    subsSet.add(memberId);
    const nextSubs = Array.from(subsSet);

    const { error: updateError } = await admin
      .from("trainer")
      .update({ subs: nextSubs })
      .eq("trainer_id", trainer_id);
    if (updateError) throw new Error(updateError.message);

    try {
      await admin
        .from("profile")
        .update({ trainer: trainer_id })
        .eq("creator_id", memberId);
    } catch {}

    let memberProfile = null;
    try {
      const { data: profileRows } = await admin
        .from("profile")
        .select("creator_id, first_name, last_name, username, email")
        .eq("creator_id", memberId)
        .limit(1);
      memberProfile = profileRows?.[0] ?? null;
    } catch {}

    return NextResponse.json({
      member: { id: memberId, profile: memberProfile },
      subs: nextSubs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unable to add member" }, { status: 500 });
  }
}
