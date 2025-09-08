"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import { Box, Paper, Stack, Typography, TextField, Button, IconButton, Chip, Snackbar, Grow } from "@mui/material";
import Image from "next/image";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";

function normalizeYouTubeUrl(input: string): string | null {
  const url = input.trim();
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    // youtu.be/<id>
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '');
      return id ? `https://www.youtube.com/watch?v=${id}` : null;
    }
    // www.youtube.com/watch?v=<id>
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube.com/watch?v=${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export default function VideosPage() {
  const router = useRouter();
  const session = useSession();
  const { isLoading: authLoading } = useSessionContext();
  const supabase = useSupabaseClient();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [videos, setVideos] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (authLoading) return;
      const uid = session?.user?.id || null;
      if (!uid) { router.push('/login'); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from('trainer')
        .select('trainer_id, videos')
        .eq('creator_id', uid)
        .limit(1);
      if (!error) {
        const tId = (data?.[0]?.trainer_id as string) || null;
        if (alive) setTrainerId(tId);
        const arr = Array.isArray(data?.[0]?.videos) ? (data?.[0]?.videos as string[]) : [];
        if (alive) setVideos(arr);
      }
      setLoading(false);
    };
    run();
    return () => { alive = false };
  }, [authLoading, session, supabase, router]);

  const addVideo = async () => {
    const norm = normalizeYouTubeUrl(newUrl);
    if (!norm) { setSnack('Enter a valid YouTube URL'); return; }
    if (videos.includes(norm)) { setSnack('Already added'); return; }
    const next = [...videos, norm];
    setVideos(next);
    setNewUrl('');
    await save(next);
  };

  const removeVideo = async (url: string) => {
    const next = videos.filter(v => v !== url);
    setVideos(next);
    await save(next);
  };

  const videoId = (url: string): string | null => {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) return u.pathname.replace('/', '') || null;
      if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
      return null;
    } catch { return null; }
  };

  const thumb = (url: string) => {
    const id = videoId(url);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
  };

  const save = async (arr: string[]) => {
    if (!trainerId) { setSnack('Create trainer first'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('trainer')
      .update({ videos: arr })
      .eq('trainer_id', trainerId);
    if (error) setSnack(error.message); else setSnack('Saved');
    setSaving(false);
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
        <div className={styles.pageContent}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <LinkIcon />
            <Typography variant="h5" fontWeight={700}>Videos</Typography>
            <Box flex={1} />
            <Button onClick={() => save(videos)} disabled={saving} variant="contained" size="small">{saving ? 'Saving…' : 'Save'}</Button>
          </Stack>

          <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
              <TextField
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Paste unlisted YouTube URL (youtu.be or youtube.com/watch?v=)"
                fullWidth
                size="small"
              />
              <Button startIcon={<AddIcon />} onClick={addVideo} variant="outlined" size="small">Add</Button>
            </Stack>
          </Paper>

          <Paper sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Your list</Typography>
            <Stack spacing={1}>
              {videos.map((v, i) => (
                <Grow in timeout={300 + i * 40} key={v}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                  <Box sx={{ width: 160, height: 90, position: 'relative', borderRadius: 1, overflow: 'hidden', bgcolor: '#111' }}>
                    {thumb(v) && (
                      <Image src={thumb(v)!} alt="thumb" fill style={{ objectFit: 'cover' }} />
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-all' }}>{v}</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" href={v} target="_blank" rel="noopener noreferrer">Open</Button>
                    <IconButton color="error" onClick={() => removeVideo(v)} aria-label="Delete video"><DeleteIcon /></IconButton>
                  </Stack>
                </Stack>
                </Grow>
              ))}
              {!videos.length && (
                <Typography variant="body2" sx={{ opacity: 0.8 }}>No videos yet. Paste a YouTube link and click Add.</Typography>
              )}
            </Stack>
          </Paper>
        </div>
      </main>
      <footer className={styles.footer}></footer>
      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack(null)} message={snack ?? ''} />
    </div>
  );
}
