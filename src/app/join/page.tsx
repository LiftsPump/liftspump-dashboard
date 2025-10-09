"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import { Box, Paper, Stack, Typography, Button, Chip, Divider, CircularProgress, Alert, IconButton, Tooltip, Avatar } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import StarRateRoundedIcon from "@mui/icons-material/StarRateRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
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
  const [trainerPhoto, setTrainerPhoto] = useState<string | null>(null);
  const [trainerStats, setTrainerStats] = useState<{ subs_count: number; tiers_count: number } | null>(null);
  const [trainerName, setTrainerName] = useState<string | null>(null);
  const [trainerBio, setTrainerBio] = useState<string | null>(null);
  const selectedTier = useMemo(() => tiers.find(t => t.key === pick) || null, [tiers, pick]);

  useEffect(() => {
    const run = async () => {
      if (!trainerId) return;
      setLoading(true); setError(null);
      try {
        // Load public trainer info (photo + counts)
        try {
          const pres = await fetch(`/api/public/trainer-info?trainer_id=${encodeURIComponent(trainerId)}`, { cache: 'no-store' })
          const pjson = await pres.json()
          setTrainerName(pjson?.display_name ?? null)
          setTrainerBio(pjson?.bio ?? null)
          setTrainerStats({ subs_count: Number(pjson?.subs_count) || 0, tiers_count: Number(pjson?.tiers_count) || 0 })
        } catch {}
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
      <main className={styles.main} style={{ padding: 0 }}>
        <div className={styles.pageContent} style={{ width: '100%', padding: 0, background: 'transparent', borderRadius: 0, boxShadow: 'none' }}>
          <Box sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            px: { xs: 2, md: 4 },
            py: { xs: 2, md: 4 },
          }}>
            <Stack spacing={1.25} sx={{ width: '100%', maxWidth: 1400 }}>
              <Stack spacing={1} direction="row" alignItems="center" sx={{ mb: 1 }}>
                <Avatar src={trainerPhoto ?? undefined} sx={{ width: 48, height: 48 }} />
                <Stack>
                  <Typography variant="h4" fontWeight={800} color="white">{trainerName ? `Join ${trainerName}` : 'Join'}</Typography>
                  {trainerBio && <Typography variant="body2" sx={{ opacity: 0.85 }}>{trainerBio}</Typography>}
                </Stack>
              </Stack>
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
              <Typography variant="subtitle1" sx={{ opacity: 0.85 }}>Choose a tier</Typography>
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2">Loading tiers…</Typography>
                </Box>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : (
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)'
                  },
                  gap: 2,
                }}>
                  {tiers.map((t) => {
                    const selected = pick === t.key
                    const features = (
                      t.key.toLowerCase() === 'pro' ? [
                        'Everything in Plus',
                        'Priority support',
                        'Advanced analytics',
                        'Weekly check-ins',
                      ] : t.key.toLowerCase() === 'plus' ? [
                        'Everything in Basic',
                        'Custom plans',
                        'Video library access',
                        'Coach messaging',
                      ] : [
                        'Starter workouts',
                        'Community access',
                        'Basic tracking',
                      ]
                    )
                    const popular = t.key.toLowerCase() === 'plus'
                    return (
                      <Paper key={t.key} sx={{
                        p: 2.5,
                        border: '1px solid',
                        borderColor: selected ? '#1AE080' : '#2a2a2a',
                        bgcolor: 'rgba(255,255,255,0.02)',
                        backgroundImage: 'radial-gradient(800px 200px at -10% -40%, rgba(26,224,128,0.06), transparent)',
                        transition: 'border-color .15s ease, transform .1s ease, box-shadow .15s ease',
                        borderRadius: 2,
                        minHeight: 300,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 28px rgba(0,0,0,0.35)' },
                      }}>
                        <Stack spacing={1}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Typography variant="h6" fontWeight={800}>{t.name}</Typography>
                            {popular && (
                              <Chip size="small" icon={<StarRateRoundedIcon />} label="Most popular" sx={{ bgcolor: '#102a1e', color: '#9ef6c5', border: '1px solid #1AE080' }} />
                            )}
                          </Stack>
                          <Typography variant="h3" fontWeight={900} color="white" sx={{ lineHeight: 1.1 }}>
                            ${t.price.toFixed(2)} <Typography component="span" variant="body2" sx={{ opacity: 0.8 }}>/ month</Typography>
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1 }}>
                            {features.map((f) => (
                              <Typography key={f} variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.95 }}>
                                <CheckCircleRoundedIcon sx={{ color: '#1AE080' }} fontSize="small" />
                                {f}
                              </Typography>
                            ))}
                          </Box>
                        </Stack>
                        <Button
                          fullWidth
                          size="medium"
                          variant={selected ? 'contained' : 'outlined'}
                          onClick={() => setPick(t.key)}
                          sx={{ mt: 2 }}
                        >
                          {selected ? 'Selected' : 'Choose'}
                        </Button>
                      </Paper>
                    )
                  })}
                  {!tiers.length && (
                    <Typography variant="body2">No active tiers available.</Typography>
                  )}
                </Box>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {already ? (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => router.push(`/api/stripe/portal`)}
                    sx={{
                      px: 3,
                      py: 1.25,
                      borderRadius: 999,
                      width: { xs: '100%', sm: 'auto' },
                    }}
                  >
                    Manage billing
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="large"
                    disabled={!pick || !trainerId}
                    onClick={subscribe}
                    endIcon={<ArrowForwardIosRoundedIcon />}
                    sx={{
                      px: 3,
                      py: 1.25,
                      borderRadius: 999,
                      bgcolor: '#1AE080',
                      color: '#0b0b0b',
                      boxShadow: '0 10px 24px rgba(26,224,128,0.25)',
                      '&:hover': { bgcolor: '#19c973', boxShadow: '0 12px 28px rgba(26,224,128,0.35)' },
                      '&:disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', boxShadow: 'none' },
                      width: { xs: '100%', sm: 'auto' },
                    }}
                  >
                    {session?.user
                      ? `Subscribe${selectedTier ? ` — $${selectedTier.price.toFixed(2)}/mo` : ''}`
                      : 'Login to subscribe'}
                  </Button>
                )}
                <Button variant="outlined" onClick={() => router.push('/')} sx={{ borderRadius: 999, width: { xs: '100%', sm: 'auto' } }}>Home</Button>
              </Stack>
            </Stack>
          </Box>
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
