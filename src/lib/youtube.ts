import ytdl from "ytdl-core";

export function extractVideoId(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  if (!trimmed) {
    throw new Error("YouTube URL is required");
  }
  if (ytdl.validateURL(trimmed)) {
    return ytdl.getURLVideoID(trimmed);
  }
  if (ytdl.validateID(trimmed)) {
    return trimmed;
  }
  throw new Error("Invalid YouTube URL or video ID");
}

export async function fetchTranscriptWithSearchApi(videoId: string): Promise<string> {
  const apiKey = process.env.SEARCHAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SEARCHAPI_API_KEY is not configured");
  }

  const endpoint = new URL("https://www.searchapi.io/api/v1/search");
  endpoint.searchParams.set("engine", "youtube_transcripts");
  endpoint.searchParams.set("video_id", videoId);
  endpoint.searchParams.set("api_key", apiKey);

  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Transcript fetch failed (${response.status}): ${text || response.statusText}`);
  }

  const data = (await response.json()) as any;
  const segments: any[] = Array.isArray(data?.transcripts) ? data.transcripts : [];
  if (!segments.length) {
    throw new Error("Transcript data not available for this video");
  }
  const combined = segments
    .map((segment) => String(segment?.text || "").trim())
    .filter(Boolean)
    .join(" ");
  if (!combined) {
    throw new Error("Transcript came back empty");
  }
  return combined;
}

