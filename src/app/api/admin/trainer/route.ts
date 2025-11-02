export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminClient } from "@/utils/supabase/admin";

export async function POST(req: Request) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server misconfigured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }
  const { user_id, display_name, bio } = await req.json();

  if (!user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  try {
    const { data: existingRows, error: fetchError } = await admin
      .from("trainer")
      .select("trainer_id")
      .eq("creator_id", user_id)
      .limit(1);

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    let trainerId = existingRows?.[0]?.trainer_id as string | undefined;

    if (!trainerId) {
      trainerId = randomUUID();
      const insertPayload: Record<string, any> = {
        trainer_id: trainerId,
        creator_id: user_id,
        subs: [],
      };
      if (display_name !== undefined) insertPayload.display_name = display_name || null;
      if (bio !== undefined) insertPayload.bio = bio || null;

      const { error: insertError } = await admin.from("trainer").insert(insertPayload);
      if (insertError) throw new Error(insertError.message);
    } else {
      const updatePayload: Record<string, any> = {};
      if (display_name !== undefined) updatePayload.display_name = display_name || null;
      if (bio !== undefined) updatePayload.bio = bio || null;

      if (Object.keys(updatePayload).length) {
        const { error: updateError } = await admin
          .from("trainer")
          .update(updatePayload)
          .eq("trainer_id", trainerId);
        if (updateError) throw new Error(updateError.message);
      }
    }

    try {
      await admin
        .from("profile")
        .update({ trainer: trainerId })
        .eq("creator_id", user_id);
    } catch {}

    const { data: trainerRows, error: finalError } = await admin
      .from("trainer")
      .select("trainer_id, creator_id, connect_account_id, display_name, bio, subs")
      .eq("trainer_id", trainerId)
      .limit(1);

    if (finalError) throw new Error(finalError.message);

    return NextResponse.json({ trainer: trainerRows?.[0] ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unable to upsert trainer" }, { status: 500 });
  }
}
