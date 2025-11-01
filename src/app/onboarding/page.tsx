"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import { Box, Paper, Stack, Typography, Button, Chip, TextField, Snackbar, Grow } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";
import LinkIcon from "@mui/icons-material/Link";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PaymentsIcon from "@mui/icons-material/Payments";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import { useRouter, useSearchParams } from "next/navigation";

export default function OnboardingPage() {
  useDocumentTitle("Onboarding | Liftspump");
  const { isLoading: authLoading } = useSessionContext();
  const session = useSession();
  const supabase = useSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeStatus = searchParams?.get('stripe');

  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [displayNameInput, setDisplayNameInput] = useState<string>("");
  const [connectAccountId, setConnectAccountId] = useState<string>("");
  const [connectInput, setConnectInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingConnect, setSavingConnect] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (session?.user) return;
    if (typeof window === "undefined") return;
    const currentSearch = window.location.search || "";
    const nextPath = `/onboarding${currentSearch}`;
    router.push(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [authLoading, session?.user, router]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (authLoading) return;
      const uid = session?.user?.id || null;
      if (!uid) return;
      const { data } = await supabase
        .from('trainer')
        .select('trainer_id, connect_account_id, display_name')
        .eq('creator_id', uid)
        .limit(1);
      if (!alive) return;
      const tId = (data?.[0]?.trainer_id as string) || null;
      setTrainerId(tId);
      const storedConnect = (data?.[0]?.connect_account_id as string) || "";
      setConnectAccountId(storedConnect);
      setConnectInput(storedConnect);
      const storedName = (data?.[0]?.display_name as string) || "";
      setDisplayName(storedName);
      setDisplayNameInput(storedName);
    };
    load();
    return () => { alive = false };
  }, [authLoading, session?.user?.id, supabase, stripeStatus]);

  const createTrainer = async () => {
    const uid = session?.user?.id || null;
    if (!uid) { setSnack('Sign in first'); return; }
    if (trainerId) { setSnack('Trainer already exists'); return; }
    const newId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const { error } = await supabase.from('trainer').insert({ creator_id: uid, trainer_id: newId });
    if (error) { setSnack(error.message); return; }
    const { error: profileError } = await supabase
      .from('profile')
      .update({ trainer: newId })
      .eq('creator_id', uid);
    setTrainerId(newId);
    if (profileError) {
      setSnack(`Trainer created, but profile link failed: ${profileError.message}`);
    } else {
      setSnack('Trainer created');
    }
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

  useEffect(() => {
    const uid = session?.user?.id || null;
    if (!uid || !trainerId) return;
    const ensure = async () => {
      const { error: linkError } = await supabase
        .from('profile')
        .update({ trainer: trainerId })
        .eq('creator_id', uid);
      if (linkError) {
        console.warn('Failed to ensure profile trainer link', linkError);
      }
    };
    ensure();
  }, [trainerId, session?.user?.id, supabase]);

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

  const saveDisplayName = async () => {
    if (!trainerId) { setSnack('Create trainer first'); return; }
    const value = displayNameInput.trim();
    setSavingName(true);
    const { error } = await supabase.from('trainer').update({ display_name: value || null }).eq('trainer_id', trainerId);
    setSavingName(false);
    if (error) {
      setSnack(error.message);
      return;
    }
    setDisplayName(value);
    setSnack('Trainer name saved');
  };

  const saveConnect = async () => {
    if (!trainerId) { setSnack('Create trainer first'); return; }
    const value = connectInput.trim();
    setSavingConnect(true);
    const { error } = await supabase.from('trainer').update({ connect_account_id: value || null }).eq('trainer_id', trainerId);
    setSavingConnect(false);
    setSnack(error ? error.message : 'Connect account saved');
    if (!error) {
      setConnectAccountId(value);
      setConnectInput(value);
    }
  };

  const inviteUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return trainerId ? `${base}/join?trainer_id=${encodeURIComponent(trainerId)}` : '';
  }, [trainerId]);

  const copyInvite = async () => { try { await navigator.clipboard?.writeText(inviteUrl); setSnack('Invite link copied'); } catch {} };

  const startStripeConnect = () => {
    if (!trainerId) { setSnack('Create trainer first'); return; }
    if (typeof window === 'undefined') return;
    const origin = window.location.origin;
    const url = new URL('/api/stripe/portal', origin);
    url.searchParams.set('mode', 'express');
    url.searchParams.set('trainer_id', trainerId);
    url.searchParams.set('return_url', `${origin}/onboarding?stripe=return`);
    url.searchParams.set('refresh_url', `${origin}/onboarding?stripe=refresh`);
    if (connectAccountId) {
      url.searchParams.set('connect_account_id', connectAccountId);
    }
    window.location.href = url.toString();
  };

  useEffect(() => {
    if (!stripeStatus) return;
    if (stripeStatus === 'return') setSnack('Stripe Connect updated');
    if (stripeStatus === 'refresh') setSnack('Stripe onboarding cancelled');
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('stripe');
      const searchString = nextUrl.searchParams.toString();
      const target = `${nextUrl.pathname}${searchString ? `?${searchString}` : ''}`;
      router.replace(target, { scroll: false });
    }
  }, [stripeStatus]);

  useEffect(() => {
    if (redirectingRef.current) return;
    if (authLoading) return;
    if (!session?.user?.id) return;
    const hasTrainer = !!trainerId;
    const hasName = !!displayName.trim();
    const hasConnect = !!connectAccountId;
    if (hasTrainer && hasName && hasConnect) {
      redirectingRef.current = true;
    }
  }, [authLoading, session?.user?.id, trainerId, displayName, connectAccountId, router]);

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
              <Button onClick={createTrainer} disabled={!!trainerId} size="small">{trainerId ? 'Already created' : 'Create trainer'}</Button>
            </Paper></Grow>

            <Grow in timeout={300}><Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Step 2 — Trainer name</Typography>
              <Typography variant="body2" sx={{ mb: 1, opacity: 0.85 }}>Set the name shown to members when they join and in emails.</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  label="Display name"
                  placeholder="e.g. Coach Jamie"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!trainerId}
                />
                <Button
                  onClick={saveDisplayName}
                  disabled={!trainerId || savingName || displayNameInput.trim() === displayName}
                  variant="contained"
                  size="small"
                >
                  {savingName ? 'Saving…' : displayName ? 'Update name' : 'Save name'}
                </Button>
              </Stack>
            </Paper></Grow>

            <Grow in timeout={350}><Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Step 3 — Stripe Connect</Typography>
              <Typography variant="body2" sx={{ mb: 1, opacity: 0.85 }}>Link your Stripe Express account so you can accept payments and payouts.</Typography>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }}>
                  {!connectAccountId && (<Button
                    onClick={startStripeConnect}
                    disabled={!trainerId}
                    variant="contained"
                    size="small"
                    startIcon={<PaymentsIcon />}
                  >
                    Start Stripe onboarding
                  </Button>)}
                  {connectAccountId && <Chip color="success" label="Stripe connected" size="small" />}
                </Stack>
              </Stack>
            </Paper></Grow>

            <Grow in timeout={400}><Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Step 4 — Invite</Typography>
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
