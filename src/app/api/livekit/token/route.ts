import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AccessToken, AgentDispatchClient, RoomServiceClient, VideoGrant } from "livekit-server-sdk";
import { JobStatus } from "@livekit/protocol";
import { z } from "zod";
import { buildPersonaPromptSuffix, PersonaShape } from "@/lib/persona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  userId: z.string().uuid(),
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

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase configuration is missing" },
      { status: 500 }
    );
  }

  const sb = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile, error: profileError } = await sb
    .from("profile")
    .select("trainer")
    .eq("creator_id", payload.userId)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const trainerId = profile?.trainer as string | undefined;
  if (!trainerId) {
    return NextResponse.json({ error: "trainer not set" }, { status: 400 });
  }

  const { data: trainerRow, error: trainerError } = await sb
    .from("trainer")
    .select("persona, voice_id")
    .eq("trainer_id", trainerId)
    .single();

  if (trainerError) {
    return NextResponse.json({ error: trainerError.message }, { status: 500 });
  }

  let persona: PersonaShape | null = null;
  if (trainerRow?.persona) {
    try {
      persona = JSON.parse(trainerRow.persona) as PersonaShape;
    } catch {
      persona = null;
    }
  }

  const suffixPrompt = buildPersonaPromptSuffix(persona);
  const timestamp = Date.now(); // ms since Unix epoch

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LiveKit credentials are missing" },
      { status: 500 }
    );
  }

  const TARGET_AGENT_NAME = "CA_NpxNJG8GrWMN"; // cloud agent name/id

  const livekitHost = process.env.LIVEKIT_HOST || (process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace(/^wss:/, 'https:'));
  if (!livekitHost) {
    return NextResponse.json({ error: "LIVEKIT_HOST or NEXT_PUBLIC_LIVEKIT_URL not set" }, { status: 500 });
  }

  const roomName = `user-${payload.userId}-${timestamp}`;
  const roomService = new RoomServiceClient(livekitHost, apiKey, apiSecret);
  const token = new AccessToken(apiKey, apiSecret, {
    identity: `user-${payload.userId}-${timestamp}`,
    ttl: 3600,
  });

  const videoGrant: VideoGrant = {
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    room: roomName,
  };
  token.addGrant(videoGrant);

  try {
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 10 * 600,
      maxParticipants: 20,
    });
  } catch (error) {
    const errorWithCode = error as { code?: string };
    if (errorWithCode?.code !== "already_exists") {
      console.error("Failed to ensure LiveKit room exists", error);
      return NextResponse.json(
        { error: "Unable to prepare LiveKit room" },
        { status: 500 }
      );
    }
  }

  const voiceId = trainerRow?.voice_id ?? process.env.LIVEKIT_DEFAULT_VOICE_ID ?? "";
  const metadataBase = {
    kind: "agent_config",
    version: 1,
    suffixPrompt,
    voice: voiceId,
    userId: payload.userId,
    trainerId,
  };
  const metadataPayload = JSON.stringify({
    ...metadataBase,
    timestamp,
  });

  const dispatchClient = new AgentDispatchClient(livekitHost, apiKey, apiSecret);
  let hasActiveMatchingDispatch = false;
  try {
    const existingDispatches = await dispatchClient.listDispatch(roomName);
    const sameAgentDispatches = existingDispatches.filter(
      (dispatch) => dispatch.agentName === TARGET_AGENT_NAME
    );

    for (const dispatch of sameAgentDispatches) {
      const jobs = dispatch.state?.jobs ?? [];
      const hasLiveJob = jobs.some((job) => {
        const status = job.state?.status;
        return status === JobStatus.JS_PENDING || status === JobStatus.JS_RUNNING;
      });

      let metadataMatches = false;
      if (dispatch.metadata) {
        try {
          const parsedMetadata = JSON.parse(dispatch.metadata) as {
            suffixPrompt?: string;
            voice?: string;
            trainerId?: string;
            userId?: string;
          };
          metadataMatches =
            parsedMetadata?.suffixPrompt === metadataBase.suffixPrompt &&
            (parsedMetadata?.voice ?? "") === metadataBase.voice &&
            parsedMetadata?.trainerId === metadataBase.trainerId &&
            parsedMetadata?.userId === metadataBase.userId;
        } catch (parseError) {
          console.warn("Failed to parse existing agent metadata", parseError);
        }
      }

      if (hasLiveJob) {
        if (metadataMatches) {
          hasActiveMatchingDispatch = true;
          continue;
        }

        try {
          await dispatchClient.deleteDispatch(dispatch.id, roomName);
        } catch (deleteError) {
          console.error("Failed to delete outdated active LiveKit dispatch", deleteError);
          return NextResponse.json(
            { error: "Unable to refresh LiveKit agent dispatch" },
            { status: 500 }
          );
        }
        continue;
      }

      try {
        await dispatchClient.deleteDispatch(dispatch.id, roomName);
      } catch (deleteError) {
        console.warn("Failed to delete stale LiveKit agent dispatch", deleteError);
      }
    }
  } catch (inspectError) {
    console.warn("Unable to inspect existing LiveKit agent dispatches", inspectError);
  }

  if (!hasActiveMatchingDispatch) {
    try {
      await dispatchClient.createDispatch(roomName, TARGET_AGENT_NAME, {
        metadata: metadataPayload,
      });
    } catch (error) {
      const errorWithCode = error as { code?: string };
      if (errorWithCode?.code !== "already_exists") {
        console.error("Failed to dispatch LiveKit agent", error);
        return NextResponse.json(
          { error: "Unable to dispatch LiveKit agent" },
          { status: 500 }
        );
      }
    }
  }

  await roomService.updateRoomMetadata(roomName, metadataPayload).catch((error) => {
    console.warn("Unable to update room metadata with latest agent payload", error);
  });

  const participants = await roomService.listParticipants(roomName);
  const agentPresent = participants.some((p) => p.identity === TARGET_AGENT_NAME);

  const jwt = await token.toJwt();
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  return NextResponse.json({
    token: jwt,
    roomName,
    trainerId,
    expiresAt,
    agentPresent,
    agent: {
      suffixPrompt,
      voice: {
        provider: "cartesia",
        voiceId: voiceId || null,
      },
    },
  });
}
