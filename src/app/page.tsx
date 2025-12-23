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
import PaidIcon from "@mui/icons-material/Paid";
import useDocumentTitle from "../hooks/useDocumentTitle";
import StatCard from "../components/StatCard";
import QuickOverviewRings from "../components/QuickOverviewRings";

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
  const [syncedThisWeek, setSyncedThisWeek] = useState<number>(0);
  const [completedGrowthPercent, setCompletedGrowthPercent] = useState<number>(0);
  const [trainerName, setTrainerName] = useState<string | null>(null);

  useDocumentTitle("Dashboard | Liftspump");

  const formatTime = (value: string | null | undefined) => {
    if (!value) return "n/a";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "n/a";
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

    const units = [
      { label: "y", value: 31536000 },
      { label: "mo", value: 2592000 },
      { label: "w", value: 604800 },
      { label: "d", value: 86400 },
      { label: "h", value: 3600 },
      { label: "m", value: 60 },
      { label: "s", value: 1 },
    ];

    for (const unit of units) {
      const amount = Math.floor(seconds / unit.value);
      if (amount >= 1) {
        return `${amount}${unit.label} ago`;
      }
    }

    return "just now";
  };

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
        .select('trainer_id, subs, display_name')
        .eq('creator_id', uid)
        .limit(1);
      if (tErr) { if (alive) { setError(tErr.message); setLoading(false); } return; }
      const tId = (tRow?.[0]?.trainer_id as string) || null;
      if (alive) setTrainerId(tId);
      const tName = (tRow?.[0]?.display_name as string) || null;
      if (alive) setTrainerName(tName);
      const subs = Array.isArray(tRow?.[0]?.subs) ? (tRow![0]!.subs as string[]) : [];
      if (alive) setSubsCount(subs.length);
      if (subs.length) {
        const { data: profileRows } = await supabase
          .from("profile")
          .select("creator_id,last_synced")
          .in("creator_id", subs);
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const syncedCount = (profileRows ?? []).filter((profile: any) => {
          if (!profile?.last_synced) return false;
          const last = new Date(profile.last_synced).getTime();
          return Number.isFinite(last) && last >= weekAgo;
        }).length;
        if (alive) setSyncedThisWeek(syncedCount);

        // TODO: confirm the correct timestamp column for completed sets (created_at vs completed_at).
        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: completedSets } = await supabase
          .from("sets")
          .select("id, completed, created_at, creator_id")
          .in("creator_id", subs)
          .eq("completed", true)
          .gte("created_at", since);
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        let prev = 0;
        let recent = 0;
        (completedSets ?? []).forEach((set: any) => {
          if (!set?.created_at) return;
          const ts = new Date(set.created_at).getTime();
          if (!Number.isFinite(ts)) return;
          if (ts < cutoff) prev += 1;
          else recent += 1;
        });
        const growth =
          prev === 0 ? (recent > 0 ? 100 : 0) : Math.round(((recent - prev) / prev) * 100);
        if (alive) setCompletedGrowthPercent(growth);
      } else {
        if (alive) {
          setSyncedThisWeek(0);
          setCompletedGrowthPercent(0);
        }
      }
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
        const activeSet = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);
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
          const key = d.toISOString().slice(0, 10);
          days[key] = { subs: 0, revenue: 0 };
        }
        (subsRows ?? []).forEach((s: any) => {
          if (!s.created_at) return;
          const key = new Date(s.created_at).toISOString().slice(0, 10);
          if (!days[key]) return;
          days[key].subs += 1;
          const cents = priceMap.get(String(s.tier_key || '')) || 0;
          days[key].revenue += Math.round(cents / 100);
        });
        const series = Object.entries(days).map(([day, v]) => ({ day, subs: v.subs, revenue: v.revenue }));
        if (alive) setChart(series);

        // Recent activity: latest routines completed by clients
        try {
          const res = await fetch("/api/dashboard/activity", { cache: "no-store" });
          const payload = await res.json().catch(() => ({}));
          if (!alive) return;
          if (res.ok) {
            const rows = Array.isArray(payload?.activity) ? payload.activity : [];
            const latest = rows.slice(0, 10).map((item: any, idx: number) => ({
              id: String(item?.id || item?.date || idx),
              title: item?.routineName || "Workout",
              subtitle: item?.clientName || "Client",
              date: formatTime(item?.date ?? null),
            }));
            setActivity(latest);
          } else {
            setActivity([]);
          }
        } catch {
          if (alive) setActivity([]);
        }
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
    try { await navigator.clipboard?.writeText(inviteUrl); } catch { }
  };

  const engagementPercent = useMemo(() => {
    if (!subsCount) return 0;
    return Math.round((syncedThisWeek / subsCount) * 100);
  }, [subsCount, syncedThisWeek]);

  const consistencyPercent = 78; // TODO: replace with workouts/week or retention metric when available.
  const growthGaugeValue = Math.min(100, Math.max(0, Math.round(Math.abs(completedGrowthPercent))));

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
        <div className={styles.pageContent}>
          <Stack spacing={2} sx={{ width: '100%' }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              sx={{ flexWrap: 'wrap', gap: { xs: 1, sm: 1.5 } }}
            >
              <Typography variant="h5" fontWeight={700} color="#1AE080">Welcome back, {trainerName}</Typography>
              <Box sx={{ flex: { xs: 'unset', sm: 1 } }} />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                {/*<Button variant="outlined" onClick={() => location.assign('/payments')}>Payments</Button>*/}
              </Stack>
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
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "0.8fr 1fr" },
                    gap: 3,
                  }}
                >
                  <QuickOverviewRings
                    metrics={[
                      {
                        label: "Engagement (7d)",
                        value: engagementPercent,
                        displayValue: `${engagementPercent}%`,
                        color: "#1AE080",
                        width: 20,
                      },
                      {
                        label: "Growth (Completed)",
                        value: growthGaugeValue,
                        displayValue: `${completedGrowthPercent >= 0 ? "+" : "-"}${completedGrowthPercent}%`,
                        color: completedGrowthPercent >= 0 ? "#34d399" : "#f87171",
                        width: 10,
                      },
                      {
                        label: "Consistency",
                        value: consistencyPercent,
                        displayValue: `${consistencyPercent}%`,
                        color: "#60a5fa",
                        width: 10,
                      },
                    ]}
                  />
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: 2,
                    }}
                  >
                    <StatCard
                      icon={<GroupIcon fontSize="small" />}
                      label="SUBSCRIBERS"
                      value={<span style={{ color: "#fff" }}>{subsCount}</span>}
                      sub="Total users subscribed to you"
                      linkLocation="/users"
                      linkText="Users screen"
                      accent="#1AE080"
                    />
                    <StatCard
                      icon={<LayersIcon fontSize="small" />}
                      label="ACTIVE TIERS"
                      value={<span style={{ color: "#fff" }}>{tiersCount}</span>}
                      sub="Manage in "
                      linkLocation="/payments"
                      linkText="Payments"
                      accent="#a78bfa"
                    />
                    <StatCard
                      icon={<FitnessCenterIcon fontSize="small" />}
                      label="TRAINER ROUTINES"
                      value={<span style={{ color: "#fff" }}>{routinesCount}</span>}
                      sub="Available to assign"
                      linkLocation="/routines"
                      linkText="Routines"
                      accent="#60a5fa"
                    />
                    <StatCard
                      icon={<PaidIcon fontSize="small" />}
                      label="Revenue"
                      value={<span style={{ color: "#fff" }}>${subsCount * 20}</span>}
                      sub="Approx. based on subscriptions"
                      linkLocation="/api/stripe/portal?mode=express"
                      linkText="Payouts"
                      accent="#34d399"
                    />
                  </Box>
                </Box>

                {/* Recent activity */}
                <Paper sx={{ p: 2, border: '1px solid', borderColor: '#2a2a2a', bgcolor: '#1a1a1a', color: 'white' }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }} color="white">Recent activity</Typography>
                  {activity.length ? (
                    <Stack spacing={1}>
                      {activity.map((a) => (
                        <Stack key={a.id} direction="row" spacing={1} alignItems="center" sx={{ py: 0.5, borderBottom: '1px dashed #2a2a2a' }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#1AE080' }} />
                          <Typography
                            variant="body2"
                            sx={{
                              width: 90,        // Tweak this number (try 80, 90, 100)
                              flexShrink: 0,
                              opacity: 0.85,
                              textAlign: 'right' // or 'right' depending on preference
                            }}
                          >
                            {a.date}
                          </Typography>
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
