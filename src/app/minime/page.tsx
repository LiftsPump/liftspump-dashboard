"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DescriptionIcon from "@mui/icons-material/Description";
import UploadIcon from "@mui/icons-material/Upload";
import VideocamIcon from "@mui/icons-material/Videocam";
import KeyIcon from "@mui/icons-material/Key";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import ReplayIcon from "@mui/icons-material/Replay";
import Header from "../../components/Header";
import Navigation from "../../components/Navigation";
import styles from "../page.module.css";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";
import useDocumentTitle from "../../hooks/useDocumentTitle";

type TrainerPersona = {
  name: string;
  style: string;
  specialties?: string[];
  catchphrases?: string[];
  constraints?: string[];
};

type PersonaResponse = {
  ok: boolean;
  persona?: TrainerPersona;
  error?: string;
};

type LivekitTokenResponse = {
  token: string;
  roomName: string;
  trainerId: string | null;
  expiresAt: string;
  agent: {
    suffixPrompt: string;
    voice: {
      provider: string;
      voiceId: string | null;
    };
  };
};

type CopyField = "token" | "room" | "prompt" | "voice" | null;

const exampleVideo = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function formatPersonaSummary(persona: TrainerPersona): string {
  const specialties = persona.specialties?.join(", ") || "";
  const catchphrases = persona.catchphrases?.map((phrase) => `"${phrase}"`).join(" | ") || "";
  const constraints = persona.constraints?.join("; ") || "";
  const lines = [
    `- Name: ${persona.name}`,
    `- Style: ${persona.style}`,
  ];
  if (specialties) lines.push(`- Specialties: ${specialties}`);
  if (catchphrases) lines.push(`- Catchphrases: ${catchphrases}`);
  if (constraints) lines.push(`- Constraints: ${constraints}`);
  lines.push("Stay in character. Keep sessions focused and safe.");
  return lines.join("\n");
}

export default function MiniMePage() {
  useDocumentTitle("MiniMe | Liftspump");
  const [videoUrl, setVideoUrl] = useState("");
  const [customPersona, setCustomPersona] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [personaSummary, setPersonaSummary] = useState<string | null>(null);
  const [personaData, setPersonaData] = useState<TrainerPersona | null>(null);

  const [userId, setUserId] = useState("");
  const session = useSession();
  const [livekitLoading, setLivekitLoading] = useState(false);
  const [livekitError, setLivekitError] = useState<string | null>(null);
  const [livekitResponse, setLivekitResponse] = useState<LivekitTokenResponse | null>(null);
  const [copiedField, setCopiedField] = useState<CopyField>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const autoStopTimeoutRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const recordedUrlRef = useRef<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState<number | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);

  const { bullets, closing } = useMemo(() => {
    if (!personaSummary) {
      return { bullets: [] as string[], closing: [] as string[] };
    }
    const lines = personaSummary
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const bulletLines: string[] = [];
    const closingLines: string[] = [];
    lines.forEach((line) => {
      if (/^[-*•]/.test(line)) {
        bulletLines.push(line.replace(/^[-*•]+\s*/, ""));
      } else if (line) {
        closingLines.push(line);
      }
    });
    return { bullets: bulletLines, closing: closingLines };
  }, [personaSummary]);

  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch (err) {
        console.warn("Failed to stop recorder during cleanup", err);
      }
      if (recordingIntervalRef.current !== null) {
        window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (autoStopTimeoutRef.current !== null) {
        window.clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
      }
    };
  }, []);

  const cleanupRecordingTimers = () => {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (autoStopTimeoutRef.current !== null) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      cleanupRecordingTimers();
      try {
        recorder.stop();
      } catch (error) {
        console.warn("Stopping media recorder failed", error);
      }
    }
  };

  const resetRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      stopRecording();
    }
    cleanupRecordingTimers();
    setIsRecording(false);
    recordingStartRef.current = null;
    setRecordingMs(0);
    setRecordedBlob(null);
    setRecordedDurationMs(null);
    setVoiceSuccess(null);
    setVoiceError(null);
    setVoiceId(null);
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    recordedUrlRef.current = null;
    recordedChunksRef.current = [];
  };

  const startRecording = async () => {
    if (voiceLoading) return;
    setVoiceError(null);
    setVoiceSuccess(null);
    setVoiceId(null);

    if (typeof window === "undefined") {
      setVoiceError("Audio recording is unavailable.");
      return;
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone access is not supported in this browser.");
      return;
    }
    if (!("MediaRecorder" in window) || !window.MediaRecorder) {
      setVoiceError("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const RecorderClass = window.MediaRecorder;
      const preferredMime =
        typeof RecorderClass.isTypeSupported === "function"
          ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
              RecorderClass.isTypeSupported(type)
            )
          : undefined;
      const recorder = preferredMime
        ? new RecorderClass(stream, { mimeType: preferredMime })
        : new RecorderClass(stream);

      recordedChunksRef.current = [];
      recordingStartRef.current = Date.now();
      setRecordedBlob(null);
      setRecordedDurationMs(null);
      setRecordedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      recordedUrlRef.current = null;
      setRecordingMs(0);
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = (event) => {
        console.error("MediaRecorder error", event);
        setVoiceError("Recording error occurred. Please try again.");
        stopRecording();
      };
      recorder.onstop = () => {
        cleanupRecordingTimers();
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch (err) {
          console.warn("Failed to stop stream tracks", err);
        }
        const finalDuration =
          recordingStartRef.current !== null ? Date.now() - recordingStartRef.current : recordingMs;
        recordingStartRef.current = null;
        setIsRecording(false);
        if (recordedChunksRef.current.length === 0) {
          recordedChunksRef.current = [];
          setRecordedBlob(null);
          setRecordedDurationMs(finalDuration);
          setRecordingMs(finalDuration);
          setRecordedUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
          recordedUrlRef.current = null;
          return;
        }
        const mimeType = recorder.mimeType || preferredMime || "audio/webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        recordedChunksRef.current = [];
        setRecordedBlob(blob);
        setRecordedDurationMs(finalDuration);
        setRecordingMs(finalDuration);
        const objectUrl = URL.createObjectURL(blob);
        setRecordedUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
        recordedUrlRef.current = objectUrl;
      };

      cleanupRecordingTimers();
      recordingIntervalRef.current = window.setInterval(() => {
        if (recordingStartRef.current !== null) {
          setRecordingMs(Date.now() - recordingStartRef.current);
        }
      }, 100);
      autoStopTimeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, 10_000);

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (error: any) {
      console.error("Unable to start recording", error);
      setVoiceError(
        error?.message?.includes("denied")
          ? "Microphone permission is required to record."
          : error?.message || "Failed to start recording."
      );
    }
  };

  const handleUploadVoice = async () => {
    if (isRecording) {
      setVoiceError("Stop the recording before uploading.");
      return;
    }
    if (!recordedBlob) {
      setVoiceError("Record a 5-10 second sample first.");
      return;
    }
    if (!session?.user?.id) {
      setVoiceError("You need to be signed in to save a voice.");
      return;
    }

    setVoiceError(null);
    setVoiceSuccess(null);
    setVoiceId(null);
    setVoiceLoading(true);

    try {
      const durationForUpload =
        recordedDurationMs ?? (recordingMs > 0 ? recordingMs : undefined);
      const filenameSeconds = durationForUpload
        ? Math.max(1, Math.round(durationForUpload / 1000))
        : "clip";
      const formData = new FormData();
      formData.append(
        "audio",
        recordedBlob,
        `minime-sample-${filenameSeconds}s.${recordedBlob.type.includes("mp4") ? "mp4" : "webm"}`
      );
      formData.append("userId", session.user.id);
      if (durationForUpload !== undefined) {
        formData.append("durationMs", String(Math.round(durationForUpload)));
      }

      let payload: any = null;
      const response = await fetch("/api/minime/voice", {
        method: "POST",
        body: formData,
      });
      try {
        payload = await response.json();
      } catch (parseError) {
        if (!response.ok) {
          throw new Error("Unable to create Cartesia voice.");
        }
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || "Cartesia voice creation failed.");
      }
      const nextVoiceId: string | undefined =
        payload?.voiceId ?? payload?.voice_id ?? payload?.id;
      if (!nextVoiceId) {
        throw new Error("Cartesia voice saved but response lacked a voice id.");
      }
      setVoiceId(nextVoiceId);
      setVoiceSuccess("Cartesia voice generated and saved to your trainer.");
    } catch (error: any) {
      setVoiceError(error?.message || "Failed to create Cartesia voice.");
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!videoUrl) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setPersonaSummary(null);
    setPersonaData(null);
    try {
      const res = await fetch("/api/minime/upsert-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: videoUrl, customPersona, userId: session?.user.id }),
      });
      const payload: PersonaResponse = await res.json();
      if (!res.ok || !payload.ok || !payload.persona) {
        throw new Error(payload.error || "Processing failed.");
      }
      setPersonaData(payload.persona);
      setPersonaSummary(formatPersonaSummary(payload.persona));
      setSuccess("Persona saved to trainer profile.");
    } catch (err: any) {
      setError(err?.message || "We hit an unexpected issue. Please try another link.");
    } finally {
      setLoading(false);
    }
  };

  const handleLivekitToken = async () => {
    if (!userId.trim()) {
      setLivekitError("User UUID is required.");
      return;
    }
    setLivekitLoading(true);
    setLivekitError(null);
    setLivekitResponse(null);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim() }),
      });
      const payload = (await res.json()) as LivekitTokenResponse & { error?: string };
      if (!res.ok) {
        throw new Error(payload?.error || "Unable to create LiveKit token.");
      }
      setLivekitResponse(payload);
    } catch (err: any) {
      setLivekitError(err?.message || "Unexpected LiveKit failure.");
    } finally {
      setLivekitLoading(false);
    }
  };

  const handleCopy = async (value: string, field: CopyField) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const activeRecordingMs = isRecording
    ? recordingMs
    : recordedDurationMs ?? (recordingMs > 0 ? recordingMs : 0);
  const recordingSecondsLabel =
    activeRecordingMs > 0 ? `${(activeRecordingMs / 1000).toFixed(1)}s` : null;

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
        <div className={styles.pageContent}>
          <Stack spacing={3} sx={{ width: "100%" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "flex-start", sm: "center" }}
              sx={{ gap: { xs: 1, sm: 1.5 } }}
            >
              <Typography variant="h5" fontWeight={700} color="white">
                MiniMe Persona Builder
              </Typography>
              <Chip
                size="small"
                color="primary"
                icon={<AutoAwesomeIcon fontSize="small" />}
                label="Powered by Gemini + Supabase"
              />
              <Box sx={{ flex: { xs: "unset", sm: 1 } }} />
              <Button
                variant="text"
                size="small"
                onClick={() => setVideoUrl(exampleVideo)}
                startIcon={<UploadIcon />}
              >
                Use sample
              </Button>
            </Stack>
            <Typography variant="body2" sx={{ color: "#b9c0cc" }}>
              Drop in any public YouTube link. We&apos;ll pull the transcript,
              ask Gemini for a persona JSON, and write it back to your trainer
              profile so the agent can stay on brand.
            </Typography>

            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", xl: "row" },
                gap: 3,
                alignItems: "stretch",
                width: "100%",
              }}
            >
              <Stack spacing={3} flex={1} minWidth={0}>
                <Paper
                  component="form"
                  onSubmit={handleSubmit}
                  sx={{
                    p: 3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    background: "rgba(10, 10, 10, 0.6)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Stack spacing={2}>
                    <TextField
                      label="YouTube video URL"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      fullWidth
                      required
                      disabled={loading}
                      InputLabelProps={{ shrink: true }}
                    />
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={loading || !videoUrl}
                        startIcon={
                          loading ? <CircularProgress size={18} /> : <AutoAwesomeIcon />
                        }
                      >
                        {loading ? "Working…" : "Generate persona"}
                      </Button>
                      {loading && (
                        <Typography variant="body2" sx={{ color: "#9ca3af" }}>
                          Fetching transcript → Summarizing → Updating trainer…
                        </Typography>
                      )}
                    </Stack>
                    {loading && <LinearProgress />}
                    {error && <Alert severity="error">{error}</Alert>}
                    {success && <Alert severity="success">{success}</Alert>}
                  </Stack>
                </Paper>

                {personaSummary && (
                  <Paper
                    sx={{
                      p: 3,
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      background: "rgba(11,11,13,0.72)",
                      border: "1px solid rgba(74,87,106,0.35)",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      alignItems={{ xs: "flex-start", md: "center" }}
                    >
                      <AutoAwesomeIcon sx={{ color: "#1AE080" }} />
                      <Box>
                        <Typography variant="h6" color="white" fontWeight={600}>
                          Persona Summary
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack spacing={1.5}>
                      {bullets.length > 0 && (
                        <Stack component="ul" spacing={1.2} sx={{ pl: 2, m: 0 }}>
                          {bullets.map((item, idx) => (
                            <Typography
                              key={idx}
                              component="li"
                              variant="body1"
                              sx={{ color: "#e5e7eb" }}
                            >
                              {item}
                            </Typography>
                          ))}
                        </Stack>
                      )}
                      {closing.length > 0 && (
                        <Typography variant="body2" sx={{ color: "#cbd5f5" }}>
                          {closing.join(" ")}
                        </Typography>
                      )}
                    </Stack>

                    {personaData && (
                      <>
                        <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.2)" }} />
                        <Stack spacing={1.5}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <DescriptionIcon sx={{ color: "#0ea5e9" }} />
                            <Typography variant="subtitle1" color="#f8fafc">
                              Persona JSON
                            </Typography>
                          </Stack>
                          <Paper
                            elevation={0}
                            sx={{
                              p: 2,
                              maxHeight: 240,
                              overflowY: "auto",
                              bgcolor: "rgba(15,23,42,0.4)",
                              border: "1px solid rgba(148, 163, 184, 0.18)",
                              color: "#cbd5f5",
                              fontFamily: "var(--font-geist-mono)",
                              fontSize: "0.85rem",
                              lineHeight: 1.5,
                            }}
                          >
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                              {JSON.stringify(personaData, null, 2)}
                            </pre>
                          </Paper>
                        </Stack>
                      </>
                    )}
                  </Paper>
                )}
              </Stack>
            </Box>
          </Stack>
        </div>
      </main>
    </div>
  );
}
