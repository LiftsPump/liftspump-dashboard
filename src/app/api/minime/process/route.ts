import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServer } from '@/utils/supabase/server'
import { YoutubeTranscript } from "youtube-transcript";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ytdl from "ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { PassThrough } from "stream";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

type PersonaResult = {
  recordId: string | null;
  videoId: string;
  personaSummary: string;
  transcript: string;
  clipPath: string | null;
  clipPublicUrl: string | null;
};

async function fetchTranscript(videoId: string): Promise<string> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "en",
    });
    const combined = segments.map((part) => part.text).join(" ").trim();
    if (!combined) {
      throw new Error("Transcript came back empty.");
    }
    return combined;
  } catch (error) {
    console.error("Transcript fetch failed", error);
    throw new Error("Unable to fetch transcript for this video.");
  }
}

async function summarizePersona(
  transcript: string,
  videoUrl: string
): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing Google Generative AI API key.");
  }
  const trimmed = transcript.length > 12000 ? transcript.slice(0, 12000) : transcript;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  const personaPrompt = [
    "You are building a persona dossier for a fitness AI assistant.",
    "Analyze the following YouTube transcript and summarize the creator's persona.",
    "Focus on: tone, expertise, target audience, signature advice, and standout quotes.",
    "Return 4-6 concise bullet points plus a closing sentence (<=40 words) describing how an AI should emulate them.",
    "",
    `Video URL: ${videoUrl}`,
    "",
    trimmed,
  ].join("\n");

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: personaPrompt }],
      },
    ],
  });
  const summary = result.response.text();
  if (!summary) {
    throw new Error("Gemini did not return a persona summary.");
  }
  return summary.trim();
}

async function buildAudioClip(videoUrl: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const audioStream = ytdl(videoUrl, {
      filter: "audioonly",
      quality: "highestaudio",
      highWaterMark: 1 << 25,
    });

    audioStream.on("error", (err) => {
      reject(new Error(`Failed to download audio: ${err.message}`));
    });

    const output = new PassThrough();
    const chunks: Buffer[] = [];

    output.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    output.on("error", (err) => {
      reject(new Error(`Error while producing clip: ${err.message}`));
    });
    output.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    ffmpeg(audioStream)
      .audioCodec("libmp3lame")
      .format("mp3")
      .setStartTime(0)
      .setDuration(10)
      .on("error", (err) => {
        reject(new Error(`FFmpeg failed: ${err.message}`));
      })
      .pipe(output, { end: true });
  });
}

async function storePersona({
  videoUrl,
  videoId,
  personaSummary,
  transcript,
  clipBuffer,
}: {
  videoUrl: string;
  videoId: string;
  personaSummary: string;
  transcript: string;
  clipBuffer: Buffer | null;
}): Promise<PersonaResult> {
  const supabase = createSupabaseServer();

  let clipPath: string | null = null;
  let clipPublicUrl: string | null = null;

  if (clipBuffer) {
    clipPath = `minime/${videoId}-${randomUUID()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("minime-clips")
      .upload(clipPath, clipBuffer, {
        cacheControl: "3600",
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (uploadError) {
      console.warn("Failed to upload audio clip", uploadError);
      clipPath = null;
    } else {
      const { data: publicUrlData } = supabase.storage
        .from("minime-clips")
        .getPublicUrl(clipPath);
      clipPublicUrl = publicUrlData?.publicUrl ?? null;
    }
  }

  const safeTranscript =
    transcript.length > 20000 ? transcript.slice(0, 20000) : transcript;
  const safeSummary =
    personaSummary.length > 8000
      ? personaSummary.slice(0, 8000)
      : personaSummary;

  const { data, error } = await supabase
    .from("minime_personas")
    .insert({
      video_url: videoUrl,
      video_id: videoId,
      persona_summary: safeSummary,
      transcript: safeTranscript,
      clip_storage_path: clipPath,
      clip_public_url: clipPublicUrl,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Failed to store persona in Supabase: ${error.message ?? "unknown"}`
    );
  }

  return {
    recordId: (data?.id as string) ?? null,
    videoId,
    personaSummary: safeSummary,
    transcript: safeTranscript,
    clipPath,
    clipPublicUrl,
  };
}

function parseVideoId(url: string): string {
  if (ytdl.validateURL(url)) {
    return ytdl.getURLVideoID(url);
  }
  if (ytdl.validateID(url)) {
    return url;
  }
  throw new Error("That does not look like a valid YouTube URL.");
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Use JSON payload." },
        { status: 400 }
      );
    }
    const body = (await req.json()) as { videoUrl?: string };
    const videoUrl = body?.videoUrl?.trim();
    if (!videoUrl) {
      return NextResponse.json(
        { error: "Please include a YouTube video URL." },
        { status: 400 }
      );
    }

    const videoId = parseVideoId(videoUrl);
    const transcript = await fetchTranscript(videoId);
    const personaSummary = await summarizePersona(transcript, videoUrl);
    const clipBuffer = await buildAudioClip(videoUrl).catch((err) => {
      console.warn("Audio clip generation failed", err);
      return null;
    });

    const stored = await storePersona({
      videoUrl,
      videoId,
      personaSummary,
      transcript,
      clipBuffer,
    });

    return NextResponse.json({ success: true, data: stored });
  } catch (error: any) {
    console.error("MiniMe processing failed", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Unexpected error while processing video.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
