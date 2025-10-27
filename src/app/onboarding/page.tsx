"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import { Box, Paper, Stack, Typography, Button, Chip, TextField, Avatar, Snackbar, Grow } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";
import LinkIcon from "@mui/icons-material/Link";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import useDocumentTitle from "../../hooks/useDocumentTitle";

export default function OnboardingPage() {
  useDocumentTitle("Onboarding | Liftspump");
  const { isLoading: authLoading } = useSessionContext();
  const session = useSession();
  const supabase = useSupabaseClient();

  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [connectId, setConnectId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (authLoading) return;
      const uid = session?.user?.id || null;
      if (!uid) return;
      const { data } = await supabase
        .from('trainer')
        .select('trainer_id, connect_account_id')
        .eq('creator_id', uid)
        .limit(1);
      if (!alive) return;
      const tId = (data?.[0]?.trainer_id as string) || null;
      setTrainerId(tId);
      setConnectId((data?.[0]?.connect_account_id as string) || "");
    };
    load();
    return () => { alive = false };
  }, [authLoading, session?.user?.id, supabase]);

  const createTrainer = async () => {
    const uid = session?.user?.id || null;
    if (!uid) { setSnack('Sign in first'); return; }
    if (trainerId) { setSnack('Trainer already exists'); return; }
    const newId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const { error } = await supabase.from('trainer').insert({ creator_id: uid, trainer_id: newId });
    if (error) setSnack(error.message); else { setTrainerId(newId); setSnack('Trainer created'); }
  };

  const seedTiers = async () => {
    if (!trainerId) { setSnack('Create trainer first'); return; }
    setSaving(true);
    const rows = [
      { trainer: trainerId, key: 'basic', name: 'Basic', price: 999, active: true },
      { trainer: trainerId, key: 'plus',  name: 'Plus',  price: 1999, active: true },
      { trainer: trainerId, key: 'pro',   name: 'Pro',   price: 3999, active: false },
    ];
    const { error } = await supabase.from('tiers').upsert(rows, { onConflict: 'trainer,key' });
    setSaving(false);
    setSnack(error ? error.message : 'Tiers seeded');
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !trainerId) return;
    setSaving(true);
    try {
      const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `trainer/${trainerId}/avatar_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('trainer-photos').upload(path, f, { upsert: true, cacheControl: '3600' });
      if (upErr) { setSnack(upErr.message); return; }
      const { data: pub } = supabase.storage.from('trainer-photos').getPublicUrl(path);
      const url = pub?.publicUrl || null;
      if (url) {
        //await supabase.from('trainer').update({ photo_url: url }).eq('trainer_id', trainerId);
        setPhotoUrl(url); setSnack('Photo uploaded');
      }
    } finally { setSaving(false); }
  };

  const saveConnect = async () => {
    if (!trainerId) { setSnack('Create trainer first'); return; }
    setSaving(true);
    const { error } = await supabase.from('trainer').update({ connect_account_id: connectId || null }).eq('trainer_id', trainerId);
    setSaving(false);
    setSnack(error ? error.message : 'Connect account saved');
  };

  const inviteUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return trainerId ? `${base}/join?trainer_id=${encodeURIComponent(trainerId)}` : '';
  }, [trainerId]);

  const copyInvite = async () => { try { await navigator.clipboard?.writeText(inviteUrl); setSnack('Invite link copied'); } catch {} };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
        <div className={styles.pageContent}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "flex-start", sm: "center" }}
              sx={{ gap: { xs: 0.75, sm: 1 } }}
            >
              <PersonAddIcon />
              <Typography variant="h5" fontWeight={700}>Trainer onboarding</Typography>
              {trainerId && <Chip size="small" label={`Trainer ${trainerId.slice(0,8)}…`} />}
              <Box sx={{ flex: { xs: "unset", sm: 1 } }} />
              {trainerId && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={copyInvite}
                  startIcon={<LinkIcon />}
                  sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                >
                  Copy invite
                </Button>
              )}
            </Stack>

            <Grow in timeout={250}><Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Step 1 — Create trainer</Typography>
              <Typography variant="body2" sx={{ mb: 1, opacity: 0.85 }}>Create a trainer profile linked to your account.</Typography>
              <Button onClick={createTrainer} disabled={!!trainerId} variant="outlined" size="small">{trainerId ? 'Already created' : 'Create trainer'}</Button>
            </Paper></Grow>

            <Grow in timeout={300}><Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Step 2 — Upload photo</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} sx={{ mt: 1 }}>
                <Avatar src={photoUrl ?? undefined} sx={{ width: 64, height: 64 }} />
                <label>
                  <input type="file" accept="image/*" hidden onChange={uploadPhoto} />
                  <Button component="span" startIcon={<PhotoCameraIcon />} disabled={!trainerId || saving} variant="outlined" size="small">Upload photo</Button>
                </label>
              </Stack>
            </Paper></Grow>

            <Grow in timeout={350}><Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Step 3 — Seed tiers</Typography>
              <Typography variant="body2" sx={{ mb: 1, opacity: 0.85 }}>Create Basic, Plus, and Pro tiers you can edit later in Payments.</Typography>
              <Button onClick={seedTiers} disabled={!trainerId || saving} startIcon={<PlaylistAddIcon />} variant="outlined" size="small">Seed defaults</Button>
            </Paper></Grow>

            {/* Stripe Connect intentionally omitted per requirements */}

            <Grow in timeout={400}><Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Step 5 — Invite</Typography>
              <Typography variant="body2" sx={{ mb: 1, opacity: 0.85 }}>Share the link below to invite members. They will sign in, subscribe, and be linked to your trainer profile.</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField value={inviteUrl} size="small" fullWidth disabled />
                <Button onClick={copyInvite} disabled={!trainerId} startIcon={<LinkIcon />} variant="contained" size="small">Copy link</Button>
              </Stack>
            </Paper></Grow>
          </Stack>
        </div>
      </main>
      <footer className={styles.footer}></footer>
      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack(null)} message={snack ?? ''} />
    </div>
  );
}
