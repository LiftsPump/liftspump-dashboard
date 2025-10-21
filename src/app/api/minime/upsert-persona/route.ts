import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { z } from "zod";
import { extractVideoId, fetchTranscriptWithSearchApi } from "@/lib/youtube";
import { buildPersonaJson } from "@/lib/persona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  youtubeUrl: z.string().url(),
  customPersona: z.string().optional(),
  userId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof payloadSchema>;
  try {
    const body = await req.json();
    payload = payloadSchema.parse(body);
  } catch (error: any) {
    const message = error?.message || "Invalid request payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined

  const adminSupabase = createAdminClient(supabaseUrl, serviceKey)

  try {
    const videoId = extractVideoId(payload.youtubeUrl);
    const transcript = await fetchTranscriptWithSearchApi(videoId);
    const personaStr = await buildPersonaJson(transcript, payload.customPersona);
    console.log(payload.userId)

    const { data: updated, error: updateErr } = await adminSupabase
      .from("trainer")
      .upsert(
        { creator_id: payload.userId, persona: personaStr },
        { onConflict: "creator_id" }
      )
      .select();
    if (updateErr) {
      throw new Error(updateErr.message || "Failed to update trainer persona");
    }

    const persona = JSON.parse(personaStr);

    return NextResponse.json({ ok: true, persona });
  } catch (error: any) {
    const message = error?.message || "Failed to upsert trainer persona";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
