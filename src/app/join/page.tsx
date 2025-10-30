"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import { Box, Paper, Stack, Typography, Button, Chip, Divider, CircularProgress, Alert, Avatar } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import StarRateRoundedIcon from "@mui/icons-material/StarRateRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Suspense, useRef } from "react";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import AppleLogo from "../../data/Apple.svg";
import App from "next/app";
import Image from "next/image";

type Tier = { key: string; name: string; price: number; active: boolean };

function JoinInner() {
  useDocumentTitle("Join | Liftspump");
  const params = useSearchParams();
  const router = useRouter();
  const trainerId = params.get("trainer_id");
  const status = params.get("status");
  const sessionIdParam = params.get("session_id");
  const preTier = params.get('tier');
  const autoStart = params.get('start') === '1';
  const ok = (status ?? "").toLowerCase() === "success";
  const PLAY_STORE = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '';

  const supabase = useSupabaseClient();
  const session = useSession();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [already, setAlready] = useState(false);
  const [trainerPhoto, setTrainerPhoto] = useState<string | null>(null);
  const [trainerName, setTrainerName] = useState<string | null>(null);
  const [trainerBio, setTrainerBio] = useState<string | null>(null);
  const [finalizeStatus, setFinalizeStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [finalizeMessage, setFinalizeMessage] = useState<string | null>(null);
  const selectedTier = useMemo(() => tiers.find(t => t.key === pick) || null, [tiers, pick]);
  const hasFinalized = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (!trainerId) return;
      setLoading(true); setError(null); setAlready(false);
      hasFinalized.current = false;
      setFinalizeStatus('idle');
      setFinalizeMessage(null);
      try {
        // Load public trainer info (photo + counts)
        try {
          const pres = await fetch(`/api/public/trainer-info?trainer_id=${encodeURIComponent(trainerId)}`, { cache: 'no-store' })
          const pjson = await pres.json()
          setTrainerName(pjson?.display_name ?? null)
          setTrainerBio(pjson?.bio ?? null)
          setTrainerPhoto(pjson?.photo_url ?? null)
        } catch {}
        const res = await fetch(`/api/public/tiers?trainer_id=${encodeURIComponent(trainerId)}`, { cache: 'no-store' })
        const json = await res.json()
        const mapped = Array.isArray(json?.tiers) ? (json.tiers as Tier[]) : []
        setTiers(mapped)
        if (mapped.length) setPick(mapped[0].key)
        if (session?.user?.id) { 
          const uid = session.user.id;
          try {
            const { data: subData, error: subsError } = await supabase
              .from('trainer')
              .select('subs')
              .eq('trainer_id', trainerId)
              .limit(1)
              .single();
            if (subsError) throw subsError;
            const list = Array.isArray(subData?.subs) ? (subData.subs as string[]) : [];
            if (list.includes(uid)) {
              setAlready(true);
            } else {
              const sres = await fetch(`/api/public/subscription-status?trainer_id=${encodeURIComponent(trainerId)}&user_id=${encodeURIComponent(uid)}`)
              const sjson = await sres.json()
              setAlready(!!sjson?.active)
            }
          } catch {
            const sres = await fetch(`/api/public/subscription-status?trainer_id=${encodeURIComponent(trainerId)}&user_id=${encodeURIComponent(uid)}`)
            const sjson = await sres.json()
            setAlready(!!sjson?.active)
          }
          //setLoading(false)
        } else {
          //setLoading(false)
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load tiers')
        setTiers([])
      } finally {
        setLoading(false)
      }
    };
    run();
  }, [trainerId, session?.user?.id, supabase]);

  useEffect(() => {
    if (!ok || !trainerId || !sessionIdParam || !session?.user?.id) {
      return;
    }
    if (sessionIdParam.includes('CHECKOUT_SESSION_ID')) {
      return;
    }
    if (finalizeStatus !== 'idle') {
      return;
    }
    if (hasFinalized.current) {
      return;
    }
    let cancelled = false;
    const finalize = async () => {
      hasFinalized.current = true;
      setFinalizeStatus('pending');
      setFinalizeMessage('Finalizing your subscription…');
      try {
        const res = await fetch('/api/subscriptions/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionIdParam, trainer_id: trainerId }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Failed to finalize subscription');
        }
        if (cancelled) return;
        setFinalizeStatus('success');
        setFinalizeMessage('All set! Your trainer access is ready.');
        setAlready(true);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('session_id');
          const nextSearch = url.searchParams.toString();
          const target = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
          router.replace(target, { scroll: false });
        }
      } catch (err: any) {
        if (cancelled) return;
        hasFinalized.current = false;
        setFinalizeStatus('error');
        setFinalizeMessage(err?.message || 'Could not finalize your subscription.');
      }
    };
    finalize();
    return () => { cancelled = true; };
  }, [ok, trainerId, sessionIdParam, session?.user?.id, router, already, finalizeStatus]);

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
    if (already) return;
    if (autoStart && trainerId) {
      if (preTier) setPick(preTier);
      if (session?.user && (preTier || pick)) {
        const run = async () => subscribe();
        run();
      }
    }
  }, [autoStart, session?.user, trainerId, preTier, already, pick]);

  const IOS_DEEP_LINK = 'liftspump://';
  const IOS_STORE_FALLBACK = 'https://testflight.apple.com/join/rqthvAXa';

  const openIOSApp = () => {
    const start = Date.now();
    // attempt to open the installed app
    window.location.href = IOS_DEEP_LINK;

    // after a short delay, if we are still here, send to TestFlight fallback
    setTimeout(() => {
      const elapsed = Date.now() - start;
      if (elapsed < 1200) {
        window.location.href = IOS_STORE_FALLBACK;
      }
    }, 800);
  };

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
                  <Chip
                    color="success"
                    label="Subscription successful"
                    sx={{
                      fontSize: '1rem',
                      height: 40,
                      px: 1.5,
                      '& .MuiChip-label': {
                        px: 1.5,
                        fontWeight: 600,
                      },
                    }}
                  />
                </Stack>
              )}
              {ok && finalizeMessage ? (
                <Alert
                  severity={finalizeStatus === 'error' ? 'error' : finalizeStatus === 'success' ? 'success' : 'info'}
                  sx={{ alignItems: 'center' }}
                  action={finalizeStatus === 'error' ? (
                    <Button color="inherit" size="small" onClick={() => { hasFinalized.current = false; setFinalizeStatus('idle'); setFinalizeMessage(null); }}>
                      Retry
                    </Button>
                  ) : undefined}
                >
                  {finalizeMessage}
                </Alert>
              ) : null}
              <Divider sx={{ my: 1 }} />
              {already ? (
                <Stack spacing={1.5}>
                  <Alert severity="success">
                    You are already subscribed. Open the app to keep progressing.
                  </Alert>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                    <Button
                      onClick={openIOSApp}
                      aria-label="Open in the App Store"
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 12,
                        bgcolor: '#000',
                        color: '#fff',
                        textTransform: 'none',
                        boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
                        '&:hover': { bgcolor: '#111', boxShadow: '0 8px 18px rgba(0,0,0,0.45)' },
                        minWidth: 0,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Image src={AppleLogo} alt="Apple" height={25} priority />
                        <Box sx={{ lineHeight: 1, textAlign: 'left' }}>
                          <Typography variant="caption" sx={{ display: 'block', fontSize: 11, letterSpacing: 0.2, opacity: 0.9 }}>
                            Open in 
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 16, mt: '-2px' }}>
                            TestFlight
                          </Typography>
                        </Box>
                      </Box>
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => router.push(`/api/stripe/portal?mode=customer`)}
                      sx={{
                        px: 3,
                        py: 1.25,
                        borderRadius: 999,
                        bgcolor: '#000',
                        color: '#fff',
                        width: { xs: '100%', sm: 'auto' },
                      }}
                    >
                      Manage billing
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <>
                  <Typography variant="subtitle1" sx={{ opacity: 0.85 }}>Choose a tier</Typography>
                  {(loading && !already) ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2">Loading...</Typography>
                    </Box>
                  ) : error ? (
                    <Alert severity="error">{error}</Alert>
                  ) : already ? (
                    <CircularProgress size={18} />
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
                            'AI Assistant',
                            'Routines',
                            'Custom Exercises',
                            'Private Videos',
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
                    {(ok) ? (
                      <Button
                        color="primary"
                        onClick={() => router.push(`/api/stripe/portal?mode=customer`)}
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
                </>
              )}
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
