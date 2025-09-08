"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import { Box, Paper, Stack, Typography, Button, Chip, RadioGroup, FormControlLabel, Radio, Divider, CircularProgress, Alert } from "@mui/material";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";

type Tier = { key: string; name: string; price: number; active: boolean };

function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const trainerId = params.get("trainer_id");
  const status = params.get("status");
  const preTier = params.get('tier');
  const autoStart = params.get('start') === '1';
  const ok = (status ?? "").toLowerCase() === "success";
  const APP_STORE = process.env.NEXT_PUBLIC_APP_STORE_URL || '';
  const PLAY_STORE = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '';

  const supabase = useSupabaseClient();
  const session = useSession();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [already, setAlready] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!trainerId) return;
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/public/tiers?trainer_id=${encodeURIComponent(trainerId)}`, { cache: 'no-store' })
        const json = await res.json()
        const mapped = Array.isArray(json?.tiers) ? (json.tiers as Tier[]) : []
        setTiers(mapped)
        if (mapped.length) setPick(mapped[0].key)
        if (session?.user?.id) {
          const sres = await fetch(`/api/public/subscription-status?trainer_id=${encodeURIComponent(trainerId)}&user_id=${encodeURIComponent(session.user.id)}`)
          const sjson = await sres.json()
          setAlready(!!sjson?.active)
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load tiers')
        setTiers([])
      } finally {
        setLoading(false)
      }
    };
    run();
  }, [trainerId, session?.user?.id]);

  const subscribe = () => {
    if (!trainerId || !pick) return;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const returnUrl = `${base}/join?trainer_id=${encodeURIComponent(trainerId)}`;
    // Build checkout URL (includes user_id only when logged in)
    const checkoutUrl = `/api/checkout?trainer_id=${encodeURIComponent(trainerId)}&tier=${encodeURIComponent(pick)}&return_url=${encodeURIComponent(returnUrl)}` + (session?.user?.id ? `&user_id=${encodeURIComponent(session.user.id)}` : '');
    if (!session?.user) {
      // First go to login, then bounce back to this join page with start=1 so we can regenerate checkout with user_id
      const backToJoin = `/join?trainer_id=${encodeURIComponent(trainerId)}&tier=${encodeURIComponent(pick)}&start=1`;
      router.push(`/login?next=${encodeURIComponent(backToJoin)}`);
      return;
    }
    window.location.href = checkoutUrl;
  };

  // If we arrived after login with tier param and start=1, auto start checkout with user_id attached
  useEffect(() => {
    if (autoStart && trainerId) {
      if (preTier) setPick(preTier);
      if (session?.user && (preTier || pick)) {
        const run = async () => subscribe();
        run();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, session?.user, trainerId, preTier]);

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.pageContent} style={{ display: 'flex', justifyContent: 'center' }}>
          <Paper sx={{ p: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", width: '100%', maxWidth: 720 }}>
            <Stack spacing={1.25}>
              <Typography variant="h5" fontWeight={700}>Join</Typography>
              {trainerId ? (
                <Typography variant="body2" sx={{ opacity: 0.85 }}>Trainer: <code>{trainerId}</code></Typography>
              ) : (
                <Typography variant="body2">Missing trainer_id</Typography>
              )}
              {ok && (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                  <Chip color="success" label="Subscription successful" />
                  {APP_STORE ? (
                    <Button href={APP_STORE} target="_blank" rel="noopener noreferrer" variant="contained" size="small">Open iOS App</Button>
                  ) : null}
                  {PLAY_STORE ? (
                    <Button href={PLAY_STORE} target="_blank" rel="noopener noreferrer" variant="outlined" size="small">Open Android App</Button>
                  ) : null}
                </Stack>
              )}
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1">Choose a tier</Typography>
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2">Loading tiers…</Typography>
                </Box>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : (
                <RadioGroup value={pick ?? ''} onChange={(e) => setPick(e.target.value)}>
                  {tiers.map(t => (
                    <FormControlLabel key={t.key} value={t.key} control={<Radio />} label={`${t.name} — $${t.price.toFixed(2)}/mo`} />
                  ))}
                  {!tiers.length && (
                    <Typography variant="body2">No active tiers available.</Typography>
                  )}
                </RadioGroup>
              )}
              <Stack direction="row" spacing={1}>
                {already ? (
                  <Button variant="contained" color="primary" onClick={() => router.push(`/api/stripe/portal`)}>Manage billing</Button>
                ) : (
                  <Button variant="contained" disabled={!pick || !trainerId} onClick={subscribe}>
                    {session?.user ? 'Subscribe' : 'Login to subscribe'}
                  </Button>
                )}
                <Button variant="outlined" onClick={() => router.push('/')}>Home</Button>
              </Stack>
            </Stack>
          </Paper>
        </div>
      </main>
      <footer className={styles.footer}></footer>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <JoinInner />
    </Suspense>
  );
}
