"use client";
import Header from "../components/Header";
import Navigation from "../components/Navigation";
import styles from "./page.module.css";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";
import { Box, Paper, Stack, Typography, Button, Chip, CircularProgress, Alert } from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import LayersIcon from "@mui/icons-material/Layers";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import InsightsIcon from "@mui/icons-material/Insights";
import PaidIcon from "@mui/icons-material/Paid";

export default function Home() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const { isLoading: authLoading } = useSessionContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [subsCount, setSubsCount] = useState<number>(0);
  const [tiersCount, setTiersCount] = useState<number>(0);
  const [routinesCount, setRoutinesCount] = useState<number>(0);
  const [activeStripeSubs, setActiveStripeSubs] = useState<number>(0);
  const [mrr, setMrr] = useState<number>(0);
  const [chart, setChart] = useState<{ day: string; subs: number; revenue: number }[]>([]);
  const [activity, setActivity] = useState<{ id: string; title: string; subtitle: string; date: string }[]>([]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (authLoading) return;
      setLoading(true); setError(null);
      const uid = session?.user?.id || null;
      if (!uid) { setLoading(false); return; }
      // trainer row
      const { data: tRow, error: tErr } = await supabase
        .from('trainer')
        .select('trainer_id, subs')
        .eq('creator_id', uid)
        .limit(1);
      if (tErr) { if (alive) { setError(tErr.message); setLoading(false); } return; }
      const tId = (tRow?.[0]?.trainer_id as string) || null;
      if (alive) setTrainerId(tId);
      const subs = Array.isArray(tRow?.[0]?.subs) ? (tRow![0]!.subs as string[]) : [];
      if (alive) setSubsCount(subs.length);
      // tiers
      if (tId) {
        const { count: tiersCnt } = await supabase
          .from('tiers')
          .select('*', { count: 'exact', head: true })
          .eq('trainer', tId)
          .eq('active', true);
        if (alive && typeof tiersCnt === 'number') setTiersCount(tiersCnt);
      }
      // routines
      const { count: rCnt } = await supabase
        .from('routines')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', uid)
        .eq('type', 'trainer');
      if (alive && typeof rCnt === 'number') setRoutinesCount(rCnt);

      // Stripe subscriptions + revenue (MRR) + simple 30-day chart
      if (tId) {
        const { data: subsRows } = await supabase
          .from('stripe_subscriptions')
          .select('id,status,created_at,tier_key')
          .eq('trainer', tId);
        const { data: tiersRows } = await supabase
          .from('tiers')
          .select('key,price,active')
          .eq('trainer', tId);
        const priceMap = new Map<string, number>();
        (tiersRows ?? []).forEach((r: any) => {
          const cents = typeof r.price === 'number' ? r.price : 0;
          priceMap.set(r.key, cents);
        });
        const activeSet = new Set(['active','trialing','past_due','unpaid','incomplete']);
        const act = (subsRows ?? []).filter((s: any) => activeSet.has(String(s.status || ''))).length;
        if (alive) setActiveStripeSubs(act);
        // MRR = sum of active subs current monthly price (approx by tier price)
        let mrrCents = 0;
        (subsRows ?? []).forEach((s: any) => {
          if (!activeSet.has(String(s.status || ''))) return;
          const cents = priceMap.get(String(s.tier_key || '')) || 0;
          mrrCents += cents;
        });
        if (alive) setMrr(Math.round(mrrCents / 100));
        // Chart: last 30 days, count new subs and revenue from created_at
        const days: { [d: string]: { subs: number; revenue: number } } = {};
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const key = d.toISOString().slice(0,10);
          days[key] = { subs: 0, revenue: 0 };
        }
        (subsRows ?? []).forEach((s: any) => {
          if (!s.created_at) return;
          const key = new Date(s.created_at).toISOString().slice(0,10);
          if (!days[key]) return;
          days[key].subs += 1;
          const cents = priceMap.get(String(s.tier_key || '')) || 0;
          days[key].revenue += Math.round(cents / 100);
        });
        const series = Object.entries(days).map(([day, v]) => ({ day, subs: v.subs, revenue: v.revenue }));
        if (alive) setChart(series);

        // Recent activity (latest 10 subs)
        const latest = (subsRows ?? [])
          .slice() // shallow copy
          .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .slice(0, 10)
          .map((s: any) => ({
            id: s.id as string,
            title: `${String(s.tier_key || 'tier')}`,
            subtitle: `${String(s.status || 'status')}`,
            date: s.created_at ? new Date(s.created_at).toLocaleString() : 'n/a',
          }));
        if (alive) setActivity(latest);
      }
      if (alive) setLoading(false);
    };
    run();
    return () => { alive = false; };
  }, [supabase, session, authLoading]);

  const copyInvite = async () => {
    if (!trainerId) return;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${base}/join?trainer_id=${encodeURIComponent(trainerId)}`;
    try { await navigator.clipboard?.writeText(inviteUrl); } catch {}
  };

  const StatCard = ({
    icon,
    label,
    value,
    sub,
    accent = '#1AE080',
  }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; accent?: string }) => (
    <Paper sx={{ p: 2, border: '1px solid', borderColor: '#2a2a2a', bgcolor: '#1a1a1a', minWidth: 220, position: 'relative', overflow: 'hidden', color: '#fff' }}>
      <Box sx={{ position: 'absolute', inset: 0, opacity: 0.12, background: `radial-gradient(600px 120px at -10% -10%, ${accent}, transparent)` }} />
      <Stack direction="column" spacing={1} alignItems="flex-start">
        <Box sx={{
          width: 36,
          height: 36,
          flex: '0 0 36px',
          aspectRatio: '1 / 1',
          borderRadius: '50%',
          bgcolor: accent,
          color: '#0b0b0b',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          boxShadow: `0 0 0 2px rgba(255,255,255,0.06) inset`,
          '& svg': { width: 20, height: 20 }
        }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 1, color: '#e5e7eb' }}>{label}</Typography>
          <Typography variant="h4" fontWeight={700} color="white">{value}</Typography>
          {sub && <Typography variant="body2" sx={{ opacity: 0.7, color: '#d1d5db' }}>{sub}</Typography>}
        </Box>
      </Stack>
    </Paper>
  );

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
        <div className={styles.pageContent}>
          <Stack spacing={2} sx={{ width: '100%' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" fontWeight={700} color="white">Overview</Typography>
              {trainerId && <Chip size="small" label={`Trainer ${trainerId.slice(0,8)}…`} />}
              <Box flex={1} />
              <Button variant="contained" onClick={copyInvite} disabled={!trainerId}>Copy invite link</Button>
              <Button variant="outlined" onClick={() => location.assign('/payments')}>Payments</Button>
              <Button variant="outlined" onClick={() => location.assign('/api/stripe/portal')}>Billing portal</Button>
            </Stack>

            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="body2">Loading trainer info…</Typography>
              </Box>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : (
              <>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
                gap: 2,
              }}>
                <StatCard icon={<GroupIcon fontSize="small" />} label="SUBSCRIBERS" value={<span style={{color:'#fff'}}>{subsCount}</span>} sub="Total users subscribed to you" accent="#1AE080" />
                <StatCard icon={<LayersIcon fontSize="small" />} label="ACTIVE TIERS" value={<span style={{color:'#fff'}}>{tiersCount}</span>} sub="Manage in Payments" accent="#a78bfa" />
                <StatCard icon={<FitnessCenterIcon fontSize="small" />} label="TRAINER ROUTINES" value={<span style={{color:'#fff'}}>{routinesCount}</span>} sub="Available to assign" accent="#60a5fa" />
                <StatCard icon={<InsightsIcon fontSize="small" />} label="ACTIVE SUBS" value={<span style={{color:'#fff'}}>{activeStripeSubs}</span>} sub="Stripe subscription status" accent="#f59e0b" />
                <StatCard icon={<PaidIcon fontSize="small" />} label="MRR" value={<span style={{color:'#fff'}}>${mrr}</span>} sub="Approx. based on tier prices" accent="#34d399" />
              </Box>

              <Paper sx={{ p: 2, border: '1px solid', borderColor: '#2a2a2a', bgcolor: '#1a1a1a', color: 'white' }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }} color="white">Last 30 days</Typography>
                <Box sx={{ width: '100%', overflowX: 'auto' }}>
                  <svg width="100%" height={200} viewBox="0 0 720 200" preserveAspectRatio="none" style={{ display: 'block' }}>
                    {(() => {
                      const pad = { l: 40, r: 10, t: 10, b: 20 };
                      const W = 720 - pad.l - pad.r;
                      const H = 200 - pad.t - pad.b;
                      const data = chart.length ? chart : [{ day: '', subs: 0, revenue: 0 }];
                      const maxY = Math.max(1, ...data.map(d => Math.max(d.subs, d.revenue)));
                      const stepX = W / Math.max(1, data.length - 1);
                      const toX = (i: number) => pad.l + i * stepX;
                      const toY = (v: number) => pad.t + (H - (v / maxY) * H);
                      // axes
                      const axis = <>
                        <line x1={pad.l} y1={pad.t+H} x2={pad.l+W} y2={pad.t+H} stroke="#333" />
                        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t+H} stroke="#333" />
                        <text x={pad.l-8} y={pad.t+12} fill="#e5e7eb" fontSize="10" textAnchor="end">{maxY}</text>
                        <text x={pad.l-8} y={pad.t+H} fill="#e5e7eb" fontSize="10" textAnchor="end">0</text>
                      </>;
                      // lines
                      const pathFor = (key: 'subs'|'revenue', color: string, fillId: string) => {
                        let d = '';
                        data.forEach((pt, i) => {
                          const x = toX(i); const y = toY(pt[key]);
                          d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
                        });
                        const dArea = `${d} L ${pad.l + W} ${pad.t + H} L ${pad.l} ${pad.t + H} Z`;
                        return <>
                          <defs>
                            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                              <stop offset="100%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <path d={dArea} fill={`url(#${fillId})`} stroke="none" />
                          <path d={d} fill="none" stroke={color} strokeWidth={2} />
                        </>
                      }
                      return <>
                        {axis}
                        {pathFor('subs', '#1AE080', 'fillSubs')}
                        {pathFor('revenue', '#7dd3fc', 'fillRev')}
                        <text x={pad.l+6} y={pad.t+12} fill="#1AE080" fontSize="10">subs</text>
                        <text x={pad.l+56} y={pad.t+12} fill="#93c5fd" fontSize="10">revenue</text>
                      </>
                    })()}
                  </svg>
                </Box>
              </Paper>

              {/* Recent activity */}
              <Paper sx={{ p: 2, border: '1px solid', borderColor: '#2a2a2a', bgcolor: '#1a1a1a', color: 'white' }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }} color="white">Recent activity</Typography>
                {activity.length ? (
                  <Stack spacing={1}>
                    {activity.map((a) => (
                      <Stack key={a.id} direction="row" spacing={1} alignItems="center" sx={{ py: 0.5, borderBottom: '1px dashed #2a2a2a' }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#1AE080' }} />
                        <Typography variant="body2" sx={{ minWidth: 120, opacity: 0.85 }}>{a.date}</Typography>
                        <Typography variant="body2" sx={{ flex: 1 }}>{a.title}</Typography>
                        <Chip size="small" label={a.subtitle} sx={{ bgcolor: '#111', color: '#e5e7eb', borderColor: '#333' }} variant="outlined" />
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>No recent activity.</Typography>
                )}
              </Paper>
              </>
            )}

            {!trainerId && !loading && (
              <Alert severity="info">No trainer profile yet. Go to Payments and click “Create trainer” to get started.</Alert>
            )}
          </Stack>
        </div>
      </main>
      <footer className={styles.footer}></footer>
    </div>
  );
}
