"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import DescriptionIcon from "@mui/icons-material/Description";
import UploadIcon from "@mui/icons-material/Upload";
import Header from "../../components/Header";
import Navigation from "../../components/Navigation";
import styles from "../page.module.css";

type PersonaPayload = {
  success: boolean;
  data?: {
    recordId: string | null;
    videoId: string;
    personaSummary: string;
    transcript: string;
    clipPath: string | null;
    clipPublicUrl: string | null;
  };
  error?: string;
};

const exampleVideo = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

export default function MiniMePage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [personaSummary, setPersonaSummary] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);

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

  const handleSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!videoUrl) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setPersonaSummary(null);
    setTranscript(null);
    setClipUrl(null);
    setRecordId(null);
    try {
      const res = await fetch("/api/minime/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      const payload: PersonaPayload = await res.json();
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "Processing failed.");
      }
      setPersonaSummary(payload.data.personaSummary);
      setTranscript(payload.data.transcript);
      setClipUrl(payload.data.clipPublicUrl ?? null);
      setRecordId(payload.data.recordId ?? null);
      setSuccess("Persona created and stored in Supabase.");
    } catch (err: any) {
      setError(
        err?.message || "We hit an unexpected issue. Please try another link."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
        <div className={styles.pageContent}>
          <Stack spacing={3} sx={{ width: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" fontWeight={700} color="white">
                MiniMe Persona Builder
              </Typography>
              <Chip
                size="small"
                color="primary"
                icon={<AutoAwesomeIcon fontSize="small" />}
                label="Powered by Gemini + Supabase"
              />
              <Box flex={1} />
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
              ask Gemini for a persona breakdown, save it into Supabase, and
              stash a 10s audio vibe clip for quick reference.
            </Typography>

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
                      Fetching transcript → Summarizing → Saving to Supabase…
                    </Typography>
                  )}
                </Stack>
                {loading && <LinearProgress />}
                {error && <Alert severity="error">{error}</Alert>}
                {success && <Alert severity="success">{success}</Alert>}
              </Stack>
            </Paper>

            {(personaSummary || transcript || clipUrl) && (
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
                    {recordId && (
                      <Typography variant="caption" sx={{ color: "#9ca3af" }}>
                        Stored as record <code>{recordId}</code>
                      </Typography>
                    )}
                  </Box>
                </Stack>

                {personaSummary && (
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
                )}

                {clipUrl ? (
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AudiotrackIcon sx={{ color: "#1AE080" }} />
                      <Typography variant="subtitle1" color="#f8fafc">
                        Audio vibe clip
                      </Typography>
                      <Chip size="small" label="10 seconds" />
                    </Stack>
                    <audio
                      controls
                      src={clipUrl}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 8,
                      }}
                    >
                      Your browser does not support audio playback.
                    </audio>
                  </Stack>
                ) : (
                  <Alert severity="warning">
                    We couldn&apos;t capture the audio clip automatically. The
                    persona text is still saved.
                  </Alert>
                )}

                {transcript && (
                  <>
                    <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.2)" }} />
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <DescriptionIcon sx={{ color: "#0ea5e9" }} />
                        <Typography variant="subtitle1" color="#f8fafc">
                          Transcript snapshot
                        </Typography>
                      </Stack>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          maxHeight: 220,
                          overflowY: "auto",
                          bgcolor: "rgba(15,23,42,0.4)",
                          border: "1px solid rgba(148, 163, 184, 0.18)",
                          color: "#cbd5f5",
                          fontFamily: "var(--font-geist-mono)",
                          fontSize: "0.85rem",
                          lineHeight: 1.5,
                        }}
                      >
                        {transcript}
                      </Paper>
                    </Stack>
                  </>
                )}
              </Paper>
            )}
          </Stack>
        </div>
      </main>
    </div>
  );
}
